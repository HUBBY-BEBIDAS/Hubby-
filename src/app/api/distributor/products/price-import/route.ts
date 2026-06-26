import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";

type PriceRow = {
  product_id: string;
  name: string;
  brand: string;
  old_price_cents: number;
  new_price_cents: number;
  change_percent: number;
};

type SkippedRow = {
  row: number;
  reason: string;
  raw_name?: string;
};

function getCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "result" in (v as object))
    return String((v as { result: unknown }).result ?? "");
  if (typeof v === "object" && "formula" in (v as object)) return ""; // fórmula rejeitada
  return String(v);
}

function getCellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "formula" in (v as object)) return null; // rejeita fórmula
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function normalizeHeader(v: string) {
  return v.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

/**
 * POST /api/distributor/products/price-import
 *
 * Lê um .xlsx com colunas: nome, marca, embalagem_tipo, embalagem_volume_ml, preco_reais
 * Identifica produtos pelo conjunto nome+marca+embalagem_tipo+volume
 * Retorna preview (matched, skipped) sem salvar — o cliente confirma depois
 *
 * Body: multipart/form-data com campo "file"
 *
 * Query param: ?confirm=true  — aplica as atualizações (usa o preview_token no body)
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get("confirm") === "true";

    // ── Modo CONFIRM: aplica preços do body ───────────────────────────────────
    if (confirm) {
      let body: unknown;
      try { body = await req.json(); } catch {
        return Response.json({ error: "Body inválido" }, { status: 400 });
      }

      const rows = (body as { rows?: PriceRow[] }).rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return Response.json({ error: "Nenhuma linha para atualizar" }, { status: 400 });
      }

      let updated = 0;
      for (const row of rows) {
        try {
          await prisma.product.update({
            where: { id: row.product_id },
            data: { price_cents: row.new_price_cents, price_updated_at: new Date() },
          });
          updated++;
        } catch { /* produto pode ter sido deletado entre preview e confirm */ }
      }

      if (updated > 0) await markDistributorProductsUpdated(distributor.id);
      return Response.json({ ok: true, updated });
    }

    // ── Modo PREVIEW: lê o arquivo ────────────────────────────────────────────
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Envie o arquivo via multipart/form-data" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "Campo 'file' ausente" }, { status: 400 });

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Arquivo muito grande (máximo 10 MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

    const sheet = wb.worksheets[0];
    if (!sheet) return Response.json({ error: "Planilha vazia" }, { status: 400 });

    // Mapeia cabeçalhos
    const headerRow = sheet.getRow(1);
    const colIndex: Record<string, number> = {};
    headerRow.eachCell((cell, col) => {
      const key = normalizeHeader(getCellText(cell));
      if (key) colIndex[key] = col;
    });

    const requiredCols = ["nome", "preco_reais"];
    for (const col of requiredCols) {
      if (!colIndex[col]) {
        return Response.json({ error: `Coluna obrigatória não encontrada: "${col}"` }, { status: 400 });
      }
    }

    // Carrega todos os produtos da distribuidora para matching
    const allProducts = await prisma.product.findMany({
      where: { distributor_id: distributor.id },
      select: { id: true, name: true, brand: true, packaging_type: true, packaging_volume_ml: true, price_cents: true },
    });

    // Índice para lookup rápido
    const productIndex = new Map<string, typeof allProducts[0]>();
    for (const p of allProducts) {
      const key = `${p.name.toLowerCase()}||${p.brand.toLowerCase()}||${p.packaging_type}||${p.packaging_volume_ml}`;
      productIndex.set(key, p);
    }

    const matched: PriceRow[] = [];
    const skipped: SkippedRow[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const nameRaw = getCellText(row.getCell(colIndex["nome"] ?? 0));
      if (!nameRaw) return;

      const brandRaw    = colIndex["marca"]              ? getCellText(row.getCell(colIndex["marca"]))              : "";
      const embTipo     = colIndex["embalagem_tipo"]     ? getCellText(row.getCell(colIndex["embalagem_tipo"]))     : "";
      const embVolRaw   = colIndex["embalagem_volume_ml"]? getCellNumber(row.getCell(colIndex["embalagem_volume_ml"])) : null;
      const precoRaw    = getCellNumber(row.getCell(colIndex["preco_reais"] ?? 0));

      if (precoRaw === null || precoRaw <= 0) {
        skipped.push({ row: rowNumber, reason: "Preço inválido ou ausente", raw_name: nameRaw });
        return;
      }

      const newPriceCents = Math.round(precoRaw * 100);

      // Tenta encontrar o produto com matching progressivo
      const key = `${nameRaw.toLowerCase()}||${brandRaw.toLowerCase()}||${embTipo}||${embVolRaw ?? 0}`;
      const keyNoVol = `${nameRaw.toLowerCase()}||${brandRaw.toLowerCase()}||${embTipo}||0`;

      let product = productIndex.get(key) ?? productIndex.get(keyNoVol);

      // Fallback: busca só por nome+marca
      if (!product && brandRaw) {
        for (const [k, p] of productIndex) {
          if (k.startsWith(`${nameRaw.toLowerCase()}||${brandRaw.toLowerCase()}||`)) {
            product = p;
            break;
          }
        }
      }
      // Fallback final: só pelo nome
      if (!product) {
        for (const [k, p] of productIndex) {
          if (k.startsWith(`${nameRaw.toLowerCase()}||`)) {
            product = p;
            break;
          }
        }
      }

      if (!product) {
        skipped.push({ row: rowNumber, reason: "Produto não encontrado no catálogo", raw_name: nameRaw });
        return;
      }

      const changePercent =
        product.price_cents > 0
          ? Math.abs(((newPriceCents - product.price_cents) * 10000) / product.price_cents) / 100
          : 100;

      matched.push({
        product_id:      product.id,
        name:            product.name,
        brand:           product.brand,
        old_price_cents: product.price_cents,
        new_price_cents: newPriceCents,
        change_percent:  Math.round(changePercent * 100) / 100,
      });
    });

    return Response.json({
      matched,
      skipped,
      summary: {
        matched_count: matched.length,
        skipped_count: skipped.length,
        high_variation_count: matched.filter((r) => r.change_percent >= 15).length,
      },
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
