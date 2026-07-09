import { NextRequest } from "next/server";
import crypto from "crypto";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  parseProductsXlsx,
  MAX_ROWS,
  MAX_FILE_SIZE_BYTES,
  type ParsedRow,
} from "@/lib/excel-parser";
import { previewKey, PREVIEW_TTL } from "@/lib/queue";

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

    // Parse do xlsx
    const buffer = Buffer.from(await file.arrayBuffer());
    const { valid_rows, errors } = await parseProductsXlsx(buffer);

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
        JSON.stringify({ valid_rows: classifiedRows })
      );
    } catch (err) {
      console.warn("[preview] Falha ao salvar preview no Redis:", err);
    }

    return Response.json({
      token,
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
