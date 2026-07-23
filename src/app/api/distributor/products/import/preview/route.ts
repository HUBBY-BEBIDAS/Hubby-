import { NextRequest } from "next/server";
import crypto from "crypto";
import ExcelJS from "exceljs";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  parseProductsXlsx,
  parseUnstructuredXlsxWithLayout,
  MAX_ROWS,
  MAX_FILE_SIZE_BYTES,
  type ParsedRow,
} from "@/lib/excel-parser";
import { previewKey, PREVIEW_TTL } from "@/lib/queue";
import { detectarLayoutComGemini } from "@/lib/gemini-parser";
import { categorizeProductHeuristic } from "@/lib/ai-categorizer";
import type { ProductCategory, PackagingType } from "@prisma/client";

// Chave de produto para lookup de upsert — mesma lógica do worker
function productLookupKey(
  row: Pick<ParsedRow, "name" | "brand" | "category" | "packaging_type" | "packaging_volume_ml">
): string {
  return [
    row.name.toLowerCase().trim(),
    row.brand.toLowerCase().trim(),
    row.category,
    row.packaging_type,
    row.packaging_volume_ml,
  ].join("|");
}

/**
 * POST /api/distributor/products/import/preview
 *
 * Recebe multipart/form-data com campo `file` (.xlsx).
 * Valida, classifica as linhas (novo/atualização/erro) e retorna o resumo.
 * Os dados validados ficam no Redis por 30 minutos aguardando confirmação.
 *
 * Body (multipart):
 *   file: File (.xlsx, max 10 MB)
 *
 * Resposta:
 *   token:        string — usar em POST /import/confirm
 *   summary:      { new_count, update_count, error_count }
 *   errors:       [{ row, field, message }] — primeiros 50 erros
 *   expires_in:   30 (minutos)
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json(
        { error: "Complete o cadastro do perfil antes de importar produtos" },
        { status: 404 }
      );
    }

    // Lê o arquivo do multipart
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Envie o arquivo como multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Campo 'file' não encontrado" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return Response.json(
        { error: "Formato inválido — envie um arquivo .xlsx" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    // Parse do xlsx tradicional
    const buffer = Buffer.from(await file.arrayBuffer());
    let valid_rows: ParsedRow[] = [];
    let errors: any[] = [];
    let isAi = false;
    let fullCsv = "";

    try {
      const traditionalResult = await parseProductsXlsx(buffer);
      valid_rows = traditionalResult.valid_rows;
      errors = traditionalResult.errors;
    } catch (err) {
      console.warn("[preview] Falha no parser tradicional, tentando Gemini:", err);
    }

    // Se o parser tradicional não retornou linhas válidas (ex: cabeçalhos incorretos), usamos Gemini
    if (valid_rows.length === 0) {
      try {
        console.log("[preview] Iniciando detecção de layout com Gemini...");
        
        // 1. Extrai a estrutura das primeiras 20 linhas formatada para o prompt da IA
        const excelStructure = await getRawExcelStructureForLayout(buffer, 20);
        
        // 2. Chama a IA para identificar o layout (cabeçalho, colunas de nome, preço, marca)
        const layout = await detectarLayoutComGemini(excelStructure);
        console.log("[preview] Layout detectado pela IA:", layout);
        
        // 3. Executa o parser local de alta velocidade com o layout detectado
        const parseResult = await parseUnstructuredXlsxWithLayout(buffer, {
          header_row: layout.header_row,
          product_name_column: layout.product_name_column,
          price_column: layout.price_column,
          brand_column: layout.brand_column
        });
        
        valid_rows = parseResult.valid_rows;
        errors = parseResult.errors;
        
      } catch (geminiErr: any) {
        console.error("[preview] Erro ao detectar layout ou processar com Gemini:", geminiErr);
        errors = [{ row: 0, field: "AI", message: `Falha ao interpretar com IA: ${geminiErr.message}` }];
      }
    }

    // Classifica linhas como novas ou atualizações
    // Carrega todos os produtos existentes uma vez (lookup eficiente)
    const existingProducts = await prisma.product.findMany({
      where: { distributor_id: distributor.id },
      select: {
        name: true,
        brand: true,
        category: true,
        packaging_type: true,
        packaging_volume_ml: true,
      },
    });

    const existingKeys = new Set(existingProducts.map(productLookupKey));

    let newCount = 0;
    let updateCount = 0;

    const classifiedRows = valid_rows.map((row) => {
      // Auto-categoriza caso categoria seja "other" ou não definida
      if (!row.category || row.category === ("other" as any)) {
        const aiResult = categorizeProductHeuristic(row.name);
        row.category = aiResult.category;
        if (!row.brand || row.brand === "Outra" || row.brand === "Genérica") {
          row.brand = aiResult.brand;
        }
      }
      const key = productLookupKey(row);
      const isUpdate = existingKeys.has(key);
      if (isUpdate) updateCount++;
      else newCount++;
      return { ...row, is_update: isUpdate };
    });

    // Armazena no Redis por 30 minutos (TTL)
    const token = crypto.randomUUID();
    const key = previewKey(distributor.id, token);

    try {
      await redis.setex(
        key,
        PREVIEW_TTL,
        JSON.stringify({ 
          valid_rows: classifiedRows,
          is_ai: isAi,
          raw_csv: fullCsv
        })
      );
    } catch (err) {
      console.warn("[preview] Falha ao salvar preview no Redis:", err);
    }

    return Response.json({
      token,
      is_ai: isAi,
      summary: {
        new_count: newCount,
        update_count: updateCount,
        error_count: errors.length,
        total_valid: valid_rows.length,
        max_rows: MAX_ROWS,
      },
      valid_rows: classifiedRows,
      // Retorna os primeiros 50 erros para não sobrecarregar a resposta
      errors: errors.slice(0, 50),
      errors_truncated: errors.length > 50,
      expires_in_minutes: PREVIEW_TTL / 60,
    });
  },
  { roles: ["distributor_admin"] }
);

/**
 * Converte a estrutura das primeiras N linhas da planilha Excel em uma representação textual clara para a IA.
 * Formato gerado:
 * Linha 5: Col A: CÓDIGO | Col B: PRODUTO | Col C: PREÇO
 * Linha 6: Col A: 2 | Col B: ABSINTO | Col C: 37.30
 */
export async function getRawExcelStructureForLayout(
  buffer: ArrayBuffer | Buffer,
  maxRows: number = 20
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer as ArrayBuffer);
  await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Planilha vazia ou formato inválido");

  const lines: string[] = [];

  function colIndexToLetter(index: number): string {
    let letter = "";
    let temp = index;
    while (temp > 0) {
      let modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter;
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > maxRows) return;

    // Ignora linhas vazias
    const allEmpty = !row.values || (row.values as unknown[]).every(
      (v) => v === undefined || v === null || v === ""
    );
    if (allEmpty) return;

    const rowCells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const val = cell.value;
      let cellText = "";
      
      if (val !== null && val !== undefined) {
        if (typeof val === "object" && "result" in (val as object)) {
          cellText = String((val as { result: unknown }).result ?? "");
        } else if (val instanceof Date) {
          cellText = val.toLocaleDateString();
        } else if (typeof val === "object") {
          cellText = JSON.stringify(val);
        } else {
          cellText = String(val);
        }
      }

      const colLetter = colIndexToLetter(colNumber);
      rowCells.push(`Col ${colLetter}: ${cellText.trim()}`);
    });

    lines.push(`Linha ${rowNumber}: ${rowCells.join(" | ")}`);
  });

  return lines.join("\n");
}

