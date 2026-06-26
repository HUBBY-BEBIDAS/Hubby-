/**
 * Parser de planilhas .xlsx para importação de produtos.
 *
 * Colunas esperadas (aceita PT e EN, sem acento, case-insensitive):
 *   nome | name | produto
 *   categoria | category
 *   marca | brand
 *   embalagem | packaging | tipo_embalagem
 *   volume_ml | volume | ml
 *   preco | price | valor
 *   disponivel | available | ativo   (opcional — padrão: true)
 */

import ExcelJS from "exceljs";
import type { ProductCategory, PackagingType } from "@prisma/client";

// ─── Limites ──────────────────────────────────────────────────────────────────

export const MAX_ROWS = 5_000;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Mapeamentos ──────────────────────────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  nome: "name", name: "name", produto: "name", product: "name",
  categoria: "category", category: "category",
  marca: "brand", brand: "brand",
  embalagem: "packaging_type", packaging: "packaging_type",
  tipo_embalagem: "packaging_type", packaging_type: "packaging_type",
  volume_ml: "packaging_volume_ml", volume: "packaging_volume_ml", ml: "packaging_volume_ml",
  preco: "price_brl", price: "price_brl", valor: "price_brl",
  preco_unitario: "price_brl", unit_price: "price_brl",
  disponivel: "available", available: "available", ativo: "available", active: "available",
};

const REQUIRED_COLUMNS = ["name", "category", "brand", "packaging_type", "packaging_volume_ml", "price_brl"];

const CATEGORY_MAP: Record<string, ProductCategory> = {
  beer: "beer", cerveja: "beer",
  whisky: "whisky", whiskey: "whisky",
  vodka: "vodka",
  gin: "gin",
  rum: "rum",
  cachaca: "cachaca", cachaça: "cachaca", cana: "cachaca",
  wine: "wine", vinho: "wine",
  sparkling: "sparkling", espumante: "sparkling", champagne: "sparkling",
  energy: "energy", energetico: "energy", energético: "energy",
  soft_drink: "soft_drink", refrigerante: "soft_drink", soda: "soft_drink",
  water: "water", agua: "water", água: "water",
  juice: "juice", suco: "juice",
  other: "other", outro: "other", outros: "other",
};

const PACKAGING_MAP: Record<string, PackagingType> = {
  garrafa: "garrafa", bottle: "garrafa",
  lata: "lata", can: "lata",
  barril: "barril", keg: "barril", barrel: "barril",
  caixa: "caixa", box: "caixa",
  fardo: "fardo", pack: "fardo",
  tetra_pak: "tetra_pak", tetrapak: "tetra_pak", "tetra pak": "tetra_pak",
  other: "other", outro: "other",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ParsedRow = {
  row_number: number;
  name: string;
  category: ProductCategory;
  brand: string;
  packaging_type: PackagingType;
  packaging_volume_ml: number;
  price_cents: number; // SEMPRE inteiro — nunca float
  available: boolean;
};

export type RowError = {
  row: number;
  field: string;
  message: string;
};

export type ParseResult = {
  valid_rows: ParsedRow[];
  errors: RowError[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, "_");
}

/** Detecta fórmula em qualquer tipo de célula. */
function isCellFormula(cell: ExcelJS.Cell): boolean {
  if (cell.type === ExcelJS.ValueType.Formula) return true;

  // Detecta tentativa de injeção de fórmula em strings
  const raw = cell.value;
  if (typeof raw === "string" && /^[=+\-@]/.test(raw)) return true;

  // Objeto de fórmula com resultado cacheado
  if (raw !== null && typeof raw === "object" && "formula" in (raw as object)) return true;

  return false;
}

/** Extrai valor de string de uma célula (sem avaliar fórmulas). */
function getCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  // Fórmula com resultado: usa o resultado cacheado
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "");
  }
  return String(v);
}

/**
 * Converte preço em reais (formato BR ou US) para centavos inteiros.
 * "12,90" → 1290 | "12.90" → 1290 | "1.290,00" → 129000
 */
function parsePriceToCents(raw: string): number | null {
  let s = raw.trim().replace(/R\$\s*/g, "");

  if (s.includes(",")) {
    // Formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Else: assume ponto como decimal (US) ou inteiro sem decimais

  const num = parseFloat(s);
  if (isNaN(num)) return null;

  // Math.round garante inteiro — evita erros de ponto flutuante como 12.90 * 100 = 1289.9999
  return Math.round(num * 100);
}

function parseBoolean(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  if (["1", "true", "sim", "s", "yes", "y", "ativo", "disponivel"].includes(s)) return true;
  if (["0", "false", "não", "nao", "n", "no", "inativo"].includes(s)) return false;
  return true; // padrão: disponível
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export async function parseProductsXlsx(buffer: ArrayBuffer | Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS types use the old non-generic Buffer — double-cast handles Node 22+ Buffer<ArrayBufferLike>
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer as ArrayBuffer);
  await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { valid_rows: [], errors: [{ row: 0, field: "", message: "Planilha vazia ou formato inválido" }] };
  }

  // Lê o cabeçalho (linha 1) e mapeia colunas
  const headerRow = sheet.getRow(1);
  const colMap: Record<number, string> = {}; // colIndex → campo interno

  headerRow.eachCell((cell, colNumber) => {
    const raw = getCellText(cell);
    const normalized = normalizeKey(raw);
    const field = COLUMN_MAP[normalized];
    if (field) colMap[colNumber] = field;
  });

  // Verifica colunas obrigatórias
  const foundFields = new Set(Object.values(colMap));
  const missingCols = REQUIRED_COLUMNS.filter((f) => !foundFields.has(f));
  if (missingCols.length > 0) {
    return {
      valid_rows: [],
      errors: [{
        row: 1,
        field: "cabeçalho",
        message: `Colunas obrigatórias não encontradas: ${missingCols.join(", ")}`,
      }],
    };
  }

  const validRows: ParsedRow[] = [];
  const errors: RowError[] = [];
  let dataRowCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    // Ignora linhas completamente vazias
    const allEmpty = !row.values || (row.values as unknown[]).every((v) => v === undefined || v === null || v === "");
    if (allEmpty) return;

    dataRowCount++;

    if (dataRowCount > MAX_ROWS) {
      if (dataRowCount === MAX_ROWS + 1) {
        errors.push({ row: rowNumber, field: "", message: `Limite de ${MAX_ROWS} linhas excedido` });
      }
      return;
    }

    const raw: Record<string, string> = {};

    // Lê cada célula e detecta fórmulas
    let formulaError = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const field = colMap[colNumber];
      if (!field) return;

      if (isCellFormula(cell)) {
        errors.push({ row: rowNumber, field, message: `Célula ${colNumber} contém fórmula — não permitido` });
        formulaError = true;
        return;
      }

      raw[field] = getCellText(cell);
    });

    if (formulaError) return;

    // Valida e converte cada campo
    const rowErrors: RowError[] = [];

    const name = raw["name"]?.trim();
    if (!name) rowErrors.push({ row: rowNumber, field: "nome", message: "Nome é obrigatório" });

    const brand = raw["brand"]?.trim();
    if (!brand) rowErrors.push({ row: rowNumber, field: "marca", message: "Marca é obrigatória" });

    const catKey = normalizeKey(raw["category"] ?? "");
    const category = CATEGORY_MAP[catKey];
    if (!category) {
      rowErrors.push({
        row: rowNumber, field: "categoria",
        message: `Categoria inválida: "${raw["category"]}". Use: ${Object.keys(CATEGORY_MAP).slice(0, 6).join(", ")}…`,
      });
    }

    const pkgKey = normalizeKey(raw["packaging_type"] ?? "");
    const packaging_type = PACKAGING_MAP[pkgKey];
    if (!packaging_type) {
      rowErrors.push({
        row: rowNumber, field: "embalagem",
        message: `Embalagem inválida: "${raw["packaging_type"]}". Use: garrafa, lata, barril, caixa, fardo, tetra_pak`,
      });
    }

    const volRaw = parseInt(raw["packaging_volume_ml"] ?? "", 10);
    const packaging_volume_ml = isNaN(volRaw) || volRaw <= 0 ? null : volRaw;
    if (!packaging_volume_ml) {
      rowErrors.push({ row: rowNumber, field: "volume_ml", message: "Volume deve ser um número inteiro positivo" });
    }

    const priceRaw = raw["price_brl"] ?? "";
    const price_cents = parsePriceToCents(priceRaw);
    if (price_cents === null) {
      rowErrors.push({ row: rowNumber, field: "preco", message: `Preço inválido: "${priceRaw}"` });
    } else if (price_cents <= 0) {
      rowErrors.push({ row: rowNumber, field: "preco", message: "Preço deve ser maior que zero" });
    }

    const available = parseBoolean(raw["available"] ?? "1");

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    validRows.push({
      row_number: rowNumber,
      name: name!,
      category: category!,
      brand: brand!,
      packaging_type: packaging_type!,
      packaging_volume_ml: packaging_volume_ml!,
      price_cents: price_cents!,
      available,
    });
  });

  return { valid_rows: validRows, errors };
}
