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

function tryParseCustomTwoColumns(sheet: ExcelJS.Worksheet): ParseResult | null {
  // Encontra colunas de descrição e preço
  let descColIndex = -1;
  let priceColIndex = -1;

  // Analisa as primeiras 50 linhas para descobrir qual coluna tem os preços e qual tem as descrições
  const colStats: Record<number, { textCount: number; priceCount: number; emptyCount: number }> = {};

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 50) return;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (!colStats[colNumber]) {
        colStats[colNumber] = { textCount: 0, priceCount: 0, emptyCount: 0 };
      }
      const text = getCellText(cell);
      if (!text) {
        colStats[colNumber].emptyCount++;
        return;
      }
      const cents = parsePriceToCents(text);
      if (cents !== null && cents > 0) {
        colStats[colNumber].priceCount++;
      } else {
        colStats[colNumber].textCount++;
      }
    });
  });

  // Encontra qual coluna tem mais preços
  let maxPriceCount = 0;
  for (const [colNumStr, stats] of Object.entries(colStats)) {
    const colNum = parseInt(colNumStr, 10);
    if (stats.priceCount > maxPriceCount) {
      maxPriceCount = stats.priceCount;
      priceColIndex = colNum;
    }
  }

  // Encontra a coluna de descrição (deve ser uma coluna de texto diferente da coluna de preço)
  let maxTextCount = 0;
  for (const [colNumStr, stats] of Object.entries(colStats)) {
    const colNum = parseInt(colNumStr, 10);
    if (colNum === priceColIndex) continue;
    if (stats.textCount > maxTextCount) {
      maxTextCount = stats.textCount;
      descColIndex = colNum;
    }
  }

  // Se não encontrou coluna de preço ou descrição com volume razoável de dados, desiste do fallback
  if (priceColIndex === -1 || descColIndex === -1 || maxPriceCount < 3) {
    return null;
  }

  const validRows: ParsedRow[] = [];
  const errors: RowError[] = [];
  let dataRowCount = 0;

  const GENERIC_PREFIXES = [
    "agua", "água", "tonica", "tônica", "azeite", "oleo", "óleo", "aperitivo", 
    "fernet", "refrigerante", "suco", "cerveja", "vinho", "bebida", "destilado", "oleo"
  ];

  const FAMOUS_BRANDS = [
    "st pierre", "st. pierre", "eazy booze", "heineken", "jack daniel", "absolut", "soya", "campari", 
    "cynar", "jagermeister", "jager", "lillet", "aperol", "brasilberg", "kosten", "salinas", 
    "paganini", "corona", "budweiser", "stella", "skol", "brahma", "antarctica", 
    "amstel", "eisenbahn", "chandon", "red bull", "monster", "coca", "guarana", 
    "fanta", "sprite", "schweppes", "smirnoff", "gordons", "tanqueray", "bombay",
    "beefeater", "ballantines", "red label", "black label", "chivas", "old parrog",
    "jose cuervo", "patron", "bacardi", "havana", "sagativa", "51", "velho barreiro",
    "ypioca", "salton", "miolo", "periquita", "andorinha", "galliano", "licor 43",
    "baileys", "amarula", "contini", "dreher", "domecq", "st pierre"
  ];

  sheet.eachRow((row, rowNumber) => {
    // Ignora linhas vazias
    const allEmpty = !row.values || (row.values as unknown[]).every((v) => v === undefined || v === null || v === "");
    if (allEmpty) return;

    const descRaw = getCellText(row.getCell(descColIndex));
    const priceRaw = getCellText(row.getCell(priceColIndex));

    if (!descRaw) return;

    // Tenta converter o preço
    const priceCents = parsePriceToCents(priceRaw);
    if (priceCents === null || priceCents <= 0) {
      // Se não tem preço válido, ignora a linha (pode ser um cabeçalho de seção)
      return;
    }

    dataRowCount++;
    if (dataRowCount > MAX_ROWS) {
      if (dataRowCount === MAX_ROWS + 1) {
        errors.push({ row: rowNumber, field: "", message: `Limite de ${MAX_ROWS} linhas excedido` });
      }
      return;
    }

    // --- Parser de Descrição Inteligente ---
    const cleanedText = descRaw.trim();
    let name = cleanedText;

    // 1. Extração de Volume
    let volumeMl = 1000; // default
    const volMatch = cleanedText.match(/\b(\d+)\s*(ml|l)\b/i);
    if (volMatch) {
      const val = parseInt(volMatch[1], 10);
      const unit = volMatch[2].toLowerCase();
      volumeMl = unit === "l" ? val * 1000 : val;
      name = name.replace(volMatch[0], "");
    } else {
      // Tenta achar números avulsos comuns no final de volume
      const endNumMatch = cleanedText.match(/\b(250|269|270|275|310|330|350|355|500|600|670|700|750|900|1000|1500)\b/);
      if (endNumMatch) {
        volumeMl = parseInt(endNumMatch[1], 10);
        name = name.replace(endNumMatch[0], "");
      }
    }

    // 2. Extração de Tipo de Embalagem
    let packagingType: PackagingType = "garrafa"; // default
    const lowerDesc = cleanedText.toLowerCase();
    if (lowerDesc.includes("lata") || lowerDesc.includes("can")) {
      packagingType = "lata";
      name = name.replace(/lata/gi, "");
    } else if (lowerDesc.includes("caixa") || lowerDesc.includes("box")) {
      packagingType = "caixa";
      name = name.replace(/caixa/gi, "");
    } else if (lowerDesc.includes("fardo") || lowerDesc.includes("pack")) {
      packagingType = "fardo";
      name = name.replace(/fardo/gi, "");
    } else if (lowerDesc.includes("barril") || lowerDesc.includes("keg")) {
      packagingType = "barril";
      name = name.replace(/barril/gi, "");
    } else if (lowerDesc.includes("tetra pak") || lowerDesc.includes("tetra_pak") || lowerDesc.includes("tetrapak")) {
      packagingType = "tetra_pak";
      name = name.replace(/tetra\s*pak|tetrapak/gi, "");
    }

    // Limpa espaços duplos
    name = name.replace(/\s+/g, " ").trim();

    // 3. Extração de Marca
    let brand = "";
    const lowerName = name.toLowerCase();
    for (const b of FAMOUS_BRANDS) {
      if (lowerName.includes(b)) {
        brand = FAMOUS_BRANDS.find((x) => x === b)!;
        brand = brand.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        break;
      }
    }

    if (!brand) {
      const words = name.split(" ").filter((w) => w.length > 1);
      let foundWord = "";
      for (const w of words) {
        const normW = normalizeKey(w);
        if (!GENERIC_PREFIXES.includes(normW)) {
          foundWord = w;
          break;
        }
      }
      brand = foundWord ? foundWord.charAt(0).toUpperCase() + foundWord.slice(1).toLowerCase() : "Diversos";
    }

    // 4. Detecção de Categoria
    let category: ProductCategory = "other";
    if (lowerDesc.includes("cerveja") || lowerDesc.includes("chopp") || lowerDesc.includes("beer") || lowerDesc.includes("heineken") || lowerDesc.includes("stella") || lowerDesc.includes("corona") || lowerDesc.includes("budweiser") || lowerDesc.includes("amstel") || lowerDesc.includes("skol") || lowerDesc.includes("brahma") || lowerDesc.includes("antarctica") || lowerDesc.includes("eisenbahn")) {
      category = "beer";
    } else if (lowerDesc.includes("whisky") || lowerDesc.includes("whiskey") || lowerDesc.includes("jack") || lowerDesc.includes("red label") || lowerDesc.includes("black label") || lowerDesc.includes("chivas")) {
      category = "whisky";
    } else if (lowerDesc.includes("vodka") || lowerDesc.includes("absolut") || lowerDesc.includes("smirnoff")) {
      category = "vodka";
    } else if (lowerDesc.includes("gin") || lowerDesc.includes("tanqueray") || lowerDesc.includes("bombay") || lowerDesc.includes("beefeater")) {
      category = "gin";
    } else if (lowerDesc.includes("rum") || lowerDesc.includes("bacardi") || lowerDesc.includes("havana")) {
      category = "rum";
    } else if (lowerDesc.includes("cachaca") || lowerDesc.includes("cachaça") || lowerDesc.includes("caninha") || lowerDesc.includes("51") || lowerDesc.includes("velho barreiro") || lowerDesc.includes("ypioca") || lowerDesc.includes("sagativa")) {
      category = "cachaca";
    } else if (lowerDesc.includes("vinho") || lowerDesc.includes("wine") || lowerDesc.includes("tinto") || lowerDesc.includes("branco") || lowerDesc.includes("salton") || lowerDesc.includes("miolo") || lowerDesc.includes("paganini")) {
      category = "wine";
    } else if (lowerDesc.includes("espumante") || lowerDesc.includes("champagne") || lowerDesc.includes("sparkling") || lowerDesc.includes("chandon")) {
      category = "sparkling";
    } else if (lowerDesc.includes("energetico") || lowerDesc.includes("energético") || lowerDesc.includes("energy") || lowerDesc.includes("red bull") || lowerDesc.includes("monster")) {
      category = "energy";
    } else if (lowerDesc.includes("refrigerante") || lowerDesc.includes("soda") || lowerDesc.includes("tonica") || lowerDesc.includes("tônica") || lowerDesc.includes("coca") || lowerDesc.includes("guarana") || lowerDesc.includes("fanta") || lowerDesc.includes("sprite") || lowerDesc.includes("schweppes")) {
      category = "soft_drink";
    } else if (lowerDesc.includes("agua") || lowerDesc.includes("água") || lowerDesc.includes("water")) {
      category = "water";
    } else if (lowerDesc.includes("suco") || lowerDesc.includes("juice")) {
      category = "juice";
    }

    if (!name) name = cleanedText;
    name = name.charAt(0).toUpperCase() + name.slice(1);

    validRows.push({
      row_number: rowNumber,
      name: name,
      category: category,
      brand: brand,
      packaging_type: packagingType,
      packaging_volume_ml: volumeMl,
      price_cents: priceCents,
      available: true,
    });
  });

  return { valid_rows: validRows, errors };
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
    // Tenta usar o parser customizado de 2 colunas como fallback
    const customResult = tryParseCustomTwoColumns(sheet);
    if (customResult && customResult.valid_rows.length > 0) {
      return customResult;
    }

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
