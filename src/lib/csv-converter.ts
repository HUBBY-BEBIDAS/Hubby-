import ExcelJS from "exceljs";

/**
 * Detecta se uma célula contém fórmula para evitar execução de fórmulas indesejadas
 */
function isCellFormula(cell: ExcelJS.Cell): boolean {
  if (cell.type === ExcelJS.ValueType.Formula) return true;
  const raw = cell.value;
  if (typeof raw === "string" && /^[=+\-@]/.test(raw)) return true;
  if (raw !== null && typeof raw === "object" && "formula" in (raw as object)) return true;
  return false;
}

/**
 * Obtém o texto limpo da célula, lidando com resultados cacheáveis de fórmulas
 */
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

/**
 * Limpa e normaliza valores de preço de formato brasileiro/texto para formato decimal limpo (ex: "73.19")
 */
function cleanAndNormalizePrice(raw: string): string {
  let s = raw.trim().replace(/R\$\s*/gi, "");
  if (s.includes(",")) {
    // Formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const num = parseFloat(s);
  if (isNaN(num)) return raw;
  return num.toFixed(2);
}

interface ConvertOptions {
  maxRows?: number;
  startRow?: number;
}

/**
 * Mapeia as colunas do Excel para identificar qual é qual de forma determinística
 */
function detectColumns(sheet: ExcelJS.Worksheet) {
  let headerRowNumber = -1;
  let descColIdx = -1;
  let priceColIdx = -1;
  let brandColIdx = -1;
  let categoryColIdx = -1;
  let packagingColIdx = -1;
  let volumeColIdx = -1;

  // 1. Tenta encontrar a linha de cabeçalho (analisando as primeiras 10 linhas)
  for (let r = 1; r <= 10; r++) {
    const row = sheet.getRow(r);
    let isHeaderCandidate = false;
    
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell).toLowerCase();
      if (
        text.includes("produto") ||
        text.includes("descri") ||
        text.includes("preço") ||
        text.includes("preco") ||
        text.includes("valor")
      ) {
        isHeaderCandidate = true;
      }
    });

    if (isHeaderCandidate) {
      headerRowNumber = r;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = getCellText(cell).toLowerCase();
        
        // Descrição do produto
        if (text.match(/prod|desc|nome/i)) {
          descColIdx = colNumber;
        }
        
        // Preço normal (exclui preço mínimo, histórico, estoque, descontos)
        if (text.match(/preço|preco|valor|unitário|unitario/i) && !text.match(/min|mín|desc|histórico|historico/i)) {
          priceColIdx = colNumber;
        }

        // Outras opcionais
        if (text.match(/marca|brand/i)) brandColIdx = colNumber;
        if (text.match(/cat/i)) categoryColIdx = colNumber;
        if (text.match(/emb|tipo/i)) packagingColIdx = colNumber;
        if (text.match(/vol|ml|litro/i)) volumeColIdx = colNumber;
      });

      if (descColIdx !== -1 && priceColIdx !== -1) {
        break;
      }
    }
  }

  // 2. Fallback de heurística se não houver cabeçalhos
  if (descColIdx === -1 || priceColIdx === -1) {
    const colStats: Record<number, { textCount: number; numericCount: number; priceCandidateCount: number }> = {};
    
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 50) return;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (!colStats[colNumber]) {
          colStats[colNumber] = { textCount: 0, numericCount: 0, priceCandidateCount: 0 };
        }
        const text = getCellText(cell).trim();
        if (!text) return;
        
        const num = parseFloat(text.replace(/R\$\s*/gi, "").replace(/\./g, "").replace(",", "."));
        if (!isNaN(num)) {
          colStats[colNumber].numericCount++;
          if (num > 0.5 && num < 1500.0) {
            colStats[colNumber].priceCandidateCount++;
          }
        } else {
          colStats[colNumber].textCount++;
        }
      });
    });

    let maxPriceCandidates = 0;
    for (const [colStr, stats] of Object.entries(colStats)) {
      const colNum = parseInt(colStr, 10);
      if (stats.priceCandidateCount > maxPriceCandidates) {
        maxPriceCandidates = stats.priceCandidateCount;
        priceColIdx = colNum;
      }
    }

    let maxTextCount = 0;
    for (const [colStr, stats] of Object.entries(colStats)) {
      const colNum = parseInt(colStr, 10);
      if (colNum === priceColIdx) continue;
      if (stats.textCount > maxTextCount) {
        maxTextCount = stats.textCount;
        descColIdx = colNum;
      }
    }
  }

  return {
    headerRowNumber: headerRowNumber !== -1 ? headerRowNumber : 1,
    descColIdx,
    priceColIdx,
    brandColIdx,
    categoryColIdx,
    packagingColIdx,
    volumeColIdx
  };
}

/**
 * Converte a primeira aba de um arquivo Excel (.xlsx) em uma string CSV compacta contendo
 * apenas as colunas de produto e preço (e opcionais úteis) identificadas, prevenindo 
 * a injeção de códigos de barras/SKUs nas colunas analisadas pelo Gemini.
 */
export async function convertXlsxToCsv(
  buffer: ArrayBuffer | Buffer,
  options: ConvertOptions = {}
): Promise<string> {
  const { maxRows, startRow } = options;

  const workbook = new ExcelJS.Workbook();
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer as ArrayBuffer);
  await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Planilha vazia ou formato inválido");
  }

  const {
    headerRowNumber,
    descColIdx,
    priceColIdx,
    brandColIdx,
    categoryColIdx,
    packagingColIdx,
    volumeColIdx
  } = detectColumns(sheet);

  if (descColIdx === -1 || priceColIdx === -1) {
    throw new Error("Não foi possível identificar colunas de produto e preço na planilha.");
  }

  const csvRows: string[] = [];
  
  // Monta o cabeçalho padrão para o CSV final
  const headers = ["RowNumber", "Name", "Price"];
  if (brandColIdx !== -1) headers.push("Brand");
  if (categoryColIdx !== -1) headers.push("Category");
  if (packagingColIdx !== -1) headers.push("Packaging");
  if (volumeColIdx !== -1) headers.push("Volume");
  csvRows.push(headers.join(","));

  const startProcessingFrom = startRow ?? (headerRowNumber + 1);
  let processedRowsCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startProcessingFrom) return;
    if (maxRows && processedRowsCount >= maxRows) return;

    // Ignora linhas vazias
    const allEmpty = !row.values || (row.values as unknown[]).every(
      (v) => v === undefined || v === null || v === ""
    );
    if (allEmpty) return;

    // Ignora linhas que contenham fórmulas por segurança
    let hasFormula = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (isCellFormula(cell)) hasFormula = true;
    });
    if (hasFormula) return;

    const nameText = getCellText(row.getCell(descColIdx));
    const priceText = getCellText(row.getCell(priceColIdx));

    if (!nameText || !priceText) return;

    const normalizedPrice = cleanAndNormalizePrice(priceText);
    const parsedPriceVal = parseFloat(normalizedPrice);

    // Pula linhas que não contêm um preço numérico positivo válido (evita erros do Zod no Gemini)
    if (isNaN(parsedPriceVal) || parsedPriceVal <= 0) {
      return;
    }
    
    // Constrói a linha sanitizada
    const rowCells = [
      String(rowNumber),
      nameText.includes(",") || nameText.includes('"') || nameText.includes("\n") 
        ? `"${nameText.replace(/"/g, '""')}"` 
        : nameText,
      normalizedPrice
    ];

    if (brandColIdx !== -1) {
      const txt = getCellText(row.getCell(brandColIdx));
      rowCells.push(txt.includes(",") ? `"${txt.replace(/"/g, '""')}"` : txt);
    }
    if (categoryColIdx !== -1) {
      const txt = getCellText(row.getCell(categoryColIdx));
      rowCells.push(txt.includes(",") ? `"${txt.replace(/"/g, '""')}"` : txt);
    }
    if (packagingColIdx !== -1) {
      const txt = getCellText(row.getCell(packagingColIdx));
      rowCells.push(txt.includes(",") ? `"${txt.replace(/"/g, '""')}"` : txt);
    }
    if (volumeColIdx !== -1) {
      const txt = getCellText(row.getCell(volumeColIdx));
      rowCells.push(txt.includes(",") ? `"${txt.replace(/"/g, '""')}"` : txt);
    }

    csvRows.push(rowCells.join(","));
    processedRowsCount++;
  });

  return csvRows.join("\n");
}
