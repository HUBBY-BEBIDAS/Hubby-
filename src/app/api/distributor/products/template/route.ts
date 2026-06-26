import ExcelJS from "exceljs";
import { withAuth } from "@/lib/with-auth";
import { NextRequest } from "next/server";

const HEADERS = [
  { key: "nome",               header: "nome",               width: 30 },
  { key: "categoria",          header: "categoria",          width: 16 },
  { key: "marca",              header: "marca",              width: 20 },
  { key: "embalagem_tipo",     header: "embalagem_tipo",     width: 16 },
  { key: "embalagem_volume_ml",header: "embalagem_volume_ml",width: 22 },
  { key: "preco_reais",        header: "preco_reais",        width: 16 },
  { key: "disponivel",         header: "disponivel",         width: 14 },
];

const EXAMPLES = [
  ["Heineken Long Neck", "beer",    "Heineken",      "garrafa", 330,  4.90, "sim"],
  ["Heineken Lata",      "beer",    "Heineken",      "lata",    350,  4.20, "sim"],
  ["Jack Daniel's",      "whisky",  "Jack Daniel's", "garrafa", 1000, 89.90,"sim"],
  ["Absolut Vodka",      "vodka",   "Absolut",       "garrafa", 750,  54.90,"sim"],
  ["Red Bull",           "energy",  "Red Bull",      "lata",    250,  8.90, "sim"],
];

const CATEGORIES = [
  "beer", "whisky", "vodka", "gin", "rum",
  "cachaca", "wine", "sparkling", "energy",
  "soft_drink", "water", "juice", "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  beer: "Cerveja", whisky: "Whisky", vodka: "Vodka", gin: "Gin",
  rum: "Rum", cachaca: "Cachaça", wine: "Vinho", sparkling: "Espumante",
  energy: "Energético", soft_drink: "Refrigerante", water: "Água",
  juice: "Suco", other: "Outro",
};

export const GET = withAuth(async (_req: NextRequest, user) => {
  if (!["distributor_admin", "distributor_collaborator", "platform_admin"].includes(user.role)) {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hubby";
  wb.created = new Date();

  // ── Aba Produtos ──────────────────────────────────────────────
  const ws = wb.addWorksheet("Produtos");

  ws.columns = HEADERS.map(({ key, header, width }) => ({ key, header, width }));

  // Estilo do cabeçalho
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1D4ED8" } },
    };
  });
  headerRow.height = 22;

  // Linhas de exemplo
  EXAMPLES.forEach((row) => {
    const added = ws.addRow(row);
    added.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
    });
  });

  // Formatar coluna preco_reais como número com 2 casas
  const priceCol = ws.getColumn("preco_reais");
  priceCol.numFmt = "#,##0.00";
  priceCol.alignment = { horizontal: "right" };

  // Formatar coluna embalagem_volume_ml como inteiro
  ws.getColumn("embalagem_volume_ml").numFmt = "0";

  // Congelar cabeçalho
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Aba Instruções ────────────────────────────────────────────
  const wi = wb.addWorksheet("Instrucoes");
  wi.columns = [{ width: 28 }, { width: 70 }];

  function addTitle(text: string) {
    const r = wi.addRow([text]);
    r.getCell(1).font = { bold: true, size: 13, color: { argb: "FF2563EB" } };
    r.height = 20;
    wi.addRow([]);
  }

  function addField(field: string, desc: string) {
    const r = wi.addRow([field, desc]);
    r.getCell(1).font = { bold: true, color: { argb: "FF0F172A" } };
    r.getCell(2).alignment = { wrapText: true };
  }

  function addNote(text: string) {
    const r = wi.addRow(["", text]);
    r.getCell(2).font = { italic: true, color: { argb: "FF64748B" } };
  }

  function addSeparator() { wi.addRow([]); }

  addTitle("Como preencher a planilha de produtos");

  addField("Coluna",         "Descrição");
  wi.lastRow!.eachCell(c => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } }; });
  addSeparator();

  addField("nome",               "Nome completo do produto  (ex: Heineken Long Neck)");
  addField("categoria",          "Categoria do produto — use exatamente um dos valores listados abaixo");
  addField("marca",              "Marca do produto  (ex: Heineken, Absolut, Jack Daniel's)");
  addField("embalagem_tipo",     "Tipo da embalagem: garrafa, lata, barril, caixa ou fardo");
  addField("embalagem_volume_ml","Volume em mililitros, somente o número  (ex: 330, 600, 1000)");
  addField("preco_reais",        "Preço unitário em reais com até 2 casas decimais  (ex: 4.90, 89.90)");
  addField("disponivel",         "Disponibilidade: sim  ou  nao");

  addSeparator();
  addTitle("Categorias válidas");

  CATEGORIES.forEach((cat) => {
    addField(cat, CATEGORY_LABELS[cat]);
  });

  addSeparator();
  addTitle("Regras importantes");

  addNote("[!] Células com fórmulas serão REJEITADAS (não comece com =, +, - ou @)");
  addNote("[!] Preço zero ou negativo será rejeitado");
  addNote("[!] O arquivo suporta no máximo 5.000 linhas por importação");
  addNote("[!] Não altere os nomes das colunas na linha 1 da aba Produtos");
  addNote("[OK] Linhas com erros são ignoradas — as demais são importadas normalmente");
  addNote("[OK] Importação em segundo plano: você pode fechar a tela após confirmar");

  addSeparator();
  addTitle("Exemplos de preenchimento correto");

  const exHeader = wi.addRow(["nome | categoria | marca | embalagem_tipo | volume_ml | preco_reais | disponivel"]);
  exHeader.getCell(1).font = { bold: true, color: { argb: "FF2563EB" } };

  EXAMPLES.forEach(([nome, cat, marca, emb, vol, preco, disp]) => {
    addNote(`${nome} | ${cat} | ${marca} | ${emb} | ${vol} | ${preco} | ${disp}`);
  });

  // ── Serializar e retornar ────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-produtos-hubby.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
