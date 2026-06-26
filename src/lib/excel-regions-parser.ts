/**
 * Parser de planilhas .xlsx para importação de regiões de entrega.
 *
 * Suporta dois formatos:
 *
 * Formato SEMANAL (planilha de roteiro):
 *   Linha 1: cabeçalho geral ("CIDADE" | "DIAS DE ENTREGA")
 *   Linha 2: sub-cabeçalho com dias: SEGUNDA-FEIRA | TERCA-FEIRA | ...
 *   Linha 3+: nome do município | SIM / NAO / FORA DE ROTA por dia
 *
 * Formato PADRÃO (modelo Hubby):
 *   Linha 1: cidade | estado | prazo_dias_uteis | horario_corte | pedido_minimo_reais | dias_rota
 *   Linha 2+: São Paulo | SP | 1 | 15:00 | 0 | seg,qua,sex
 *
 * Regras comuns:
 *   - Linha com "FORA DE ROTA" → ignorada
 *   - Estado padrão quando ausente: SP
 */

import ExcelJS from "exceljs";

// ─── Mapeamento de cabeçalhos de dia ──────────────────────────────────────────

const DAY_HEADER_MAP: Record<string, string> = {
  "segunda-feira":  "monday",
  "segunda":        "monday",
  "terca-feira":    "tuesday",
  "tercafeira":     "tuesday",
  "terca":          "tuesday",
  "quarta-feira":   "wednesday",
  "quartafeira":    "wednesday",
  "quarta":         "wednesday",
  "quinta-feira":   "thursday",
  "quintafeira":    "thursday",
  "quinta":         "thursday",
  "sexta-feira":    "friday",
  "sextafeira":     "friday",
  "sexta":          "friday",
  "sabado":         "saturday",
  "sab":            "saturday",
};

// Abreviações usadas no formato padrão (dias_rota)
const DAY_ABBR_MAP: Record<string, string> = {
  seg: "monday",
  ter: "tuesday",
  qua: "wednesday",
  qui: "thursday",
  sex: "friday",
  sab: "saturday",
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ParsedRegion = {
  city: string;
  state: string;
  route_days: string[];
  // Presentes apenas no formato padrão; undefined = usar default no destino
  delivery_days_business?: number;
  cutoff_time?: string;
  minimum_order_cents?: number;
};

export type RegionsParseResult = {
  regions: ParsedRegion[];
  ignored_count: number;
  total_count: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function getCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "");
  }
  return String(v);
}

function getCellNumber(cell: ExcelJS.Cell): number | undefined {
  const v = cell.value;
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

/** Converte "SAO PAULO" → "São Paulo", preservando artigos em minúsculo. */
function titleCasePT(s: string): string {
  const lowercase = new Set(["de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((word, i) =>
      i === 0 || !lowercase.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(" ");
}

// ─── Detecção de formato ──────────────────────────────────────────────────────

type SheetFormat = "standard" | "weekly";

function detectFormat(sheet: ExcelJS.Worksheet): SheetFormat {
  const row1 = sheet.getRow(1);
  const headers: string[] = [];
  row1.eachCell((cell) => headers.push(normalizeHeader(getCellText(cell))));

  if (headers.includes("prazo_dias_uteis") || headers.includes("dias_rota") || headers.includes("horario_corte")) {
    return "standard";
  }
  return "weekly";
}

// ─── Parser formato padrão ────────────────────────────────────────────────────

function parseStandardFormat(sheet: ExcelJS.Worksheet): RegionsParseResult {
  const headerRow = sheet.getRow(1);
  const colIndex: Record<string, number> = {};

  headerRow.eachCell((cell, col) => {
    colIndex[normalizeHeader(getCellText(cell))] = col;
  });

  const get = (row: ExcelJS.Row, key: string) => {
    const col = colIndex[key];
    return col !== undefined ? row.getCell(col) : undefined;
  };

  const regions: ParsedRegion[] = [];
  let ignoredCount = 0;
  let totalCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;

    const cityCell = get(row, "cidade");
    const city = cityCell ? getCellText(cityCell).trim() : "";
    if (!city) return;

    // Células com fórmula são rejeitadas
    const rawCityValue = cityCell?.value;
    if (typeof rawCityValue === "object" && rawCityValue !== null && "formula" in rawCityValue) {
      ignoredCount++;
      totalCount++;
      return;
    }

    if (city.toUpperCase().includes("FORA")) {
      ignoredCount++;
      totalCount++;
      return;
    }

    totalCount++;

    // dias_rota: "seg,qua,sex" → ["monday","wednesday","friday"]
    const diasRota = get(row, "dias_rota");
    const diasRaw = diasRota ? getCellText(diasRota).toLowerCase().replace(/\s/g, "") : "";
    const routeDays = diasRaw
      .split(",")
      .map((d) => DAY_ABBR_MAP[d.trim()])
      .filter(Boolean) as string[];

    if (routeDays.length === 0) {
      ignoredCount++;
      return;
    }

    routeDays.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

    const stateCell = get(row, "estado");
    const state = stateCell
      ? getCellText(stateCell).toUpperCase().trim().slice(0, 2) || "SP"
      : "SP";

    const prazoCell = get(row, "prazo_dias_uteis");
    const prazo = prazoCell ? getCellNumber(prazoCell) : undefined;

    const corteCell = get(row, "horario_corte");
    const corteRaw = corteCell ? getCellText(corteCell).trim() : "";
    // Aceita "15:00" ou número decimal do Excel (ex: 0.625 = 15:00)
    let cutoff_time: string | undefined;
    if (/^\d{1,2}:\d{2}$/.test(corteRaw)) {
      cutoff_time = corteRaw.padStart(5, "0");
    } else {
      const n = parseFloat(corteRaw);
      if (!isNaN(n) && n > 0 && n < 1) {
        const totalMinutes = Math.round(n * 24 * 60);
        const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
        const m = (totalMinutes % 60).toString().padStart(2, "0");
        cutoff_time = `${h}:${m}`;
      }
    }

    const minimoCell = get(row, "pedido_minimo_reais");
    const minimoReais = minimoCell ? getCellNumber(minimoCell) : undefined;
    const minimum_order_cents =
      minimoReais !== undefined ? Math.round(minimoReais * 100) : undefined;

    regions.push({
      city: titleCasePT(city),
      state,
      route_days: routeDays,
      ...(prazo !== undefined && { delivery_days_business: Math.round(prazo) }),
      ...(cutoff_time !== undefined && { cutoff_time }),
      ...(minimum_order_cents !== undefined && { minimum_order_cents }),
    });
  });

  return { regions, ignored_count: ignoredCount, total_count: totalCount };
}

// ─── Parser formato semanal ───────────────────────────────────────────────────

function parseWeeklyFormat(sheet: ExcelJS.Worksheet): RegionsParseResult {
  const subHeaderRow = sheet.getRow(2);
  const dayColMap: Record<number, string> = {};

  subHeaderRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(getCellText(cell));
    const day = DAY_HEADER_MAP[normalized];
    if (day) dayColMap[colNumber] = day;
  });

  if (Object.keys(dayColMap).length === 0) {
    return { regions: [], ignored_count: 0, total_count: 0 };
  }

  const regions: ParsedRegion[] = [];
  let ignoredCount = 0;
  let totalCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;

    const city = getCellText(row.getCell(1)).trim();
    if (!city) return;

    totalCount++;

    let foraDeRota = false;
    const routeDays: string[] = [];

    for (const [colStr, dayName] of Object.entries(dayColMap)) {
      const raw = getCellText(row.getCell(Number(colStr)))
        .toUpperCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (raw.includes("FORA")) {
        foraDeRota = true;
        break;
      }

      if (raw === "SIM" || raw === "S") {
        routeDays.push(dayName);
      }
    }

    if (foraDeRota || routeDays.length === 0) {
      ignoredCount++;
      return;
    }

    routeDays.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

    regions.push({
      city: titleCasePT(city),
      state: "SP",
      route_days: routeDays,
    });
  });

  return { regions, ignored_count: ignoredCount, total_count: totalCount };
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export async function parseRegionsXlsx(
  buffer: ArrayBuffer | Buffer
): Promise<RegionsParseResult> {
  const workbook = new ExcelJS.Workbook();
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer as ArrayBuffer);
  await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { regions: [], ignored_count: 0, total_count: 0 };
  }

  const format = detectFormat(sheet);
  return format === "standard"
    ? parseStandardFormat(sheet)
    : parseWeeklyFormat(sheet);
}
