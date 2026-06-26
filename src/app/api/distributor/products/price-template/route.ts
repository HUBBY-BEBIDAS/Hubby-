import ExcelJS from "exceljs";
import { withAuth } from "@/lib/with-auth";
import { NextRequest } from "next/server";

const EXAMPLES = [
  ["Heineken Long Neck", "Heineken",      "garrafa", 330,  5.50],
  ["Heineken Lata",      "Heineken",      "lata",    350,  4.50],
  ["Jack Daniel's",      "Jack Daniel's", "garrafa", 1000, 94.90],
  ["Absolut Vodka",      "Absolut",       "garrafa", 750,  59.90],
  ["Red Bull",           "Red Bull",      "lata",    250,  9.50],
];

export const GET = withAuth(async (_req: NextRequest, user) => {
  if (!["distributor_admin", "distributor_collaborator", "platform_admin"].includes(user.role)) {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hubby";
  wb.created = new Date();

  // ── Aba Preços ───────────────────────────────────────────────
  const ws = wb.addWorksheet("Preços");
  ws.columns = [
    { key: "nome",               header: "nome",               width: 30 },
    { key: "marca",              header: "marca",              width: 20 },
    { key: "embalagem_tipo",     header: "embalagem_tipo",     width: 16 },
    { key: "embalagem_volume_ml",header: "embalagem_volume_ml",width: 22 },
    { key: "preco_reais",        header: "preco_reais",        width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF6D28D9" } } };
  });
  headerRow.height = 22;

  EXAMPLES.forEach((row) => {
    const added = ws.addRow(row);
    added.eachCell((cell) => { cell.alignment = { vertical: "middle" }; });
  });

  ws.getColumn("preco_reais").numFmt = "#,##0.00";
  ws.getColumn("preco_reais").alignment = { horizontal: "right" };
  ws.getColumn("embalagem_volume_ml").numFmt = "0";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Aba Instruções ───────────────────────────────────────────
  const wi = wb.addWorksheet("Instrucoes");
  wi.columns = [{ width: 26 }, { width: 68 }];

  function addTitle(text: string) {
    const r = wi.addRow([text]);
    r.getCell(1).font = { bold: true, size: 13, color: { argb: "FF7C3AED" } };
    r.height = 20;
    wi.addRow([]);
  }
  function addField(f: string, d: string) {
    const r = wi.addRow([f, d]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { wrapText: true };
  }
  function addNote(t: string) {
    const r = wi.addRow(["", t]);
    r.getCell(2).font = { italic: true, color: { argb: "FF64748B" } };
  }

  addTitle("Planilha de atualização de preços");
  addField("Coluna", "Descrição");
  wi.lastRow!.eachCell(c => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } }; });
  wi.addRow([]);
  addField("nome",               "Nome do produto — deve coincidir com o nome cadastrado");
  addField("marca",              "Marca do produto");
  addField("embalagem_tipo",     "Tipo da embalagem: garrafa, lata, barril, caixa, fardo, tetra_pak, other");
  addField("embalagem_volume_ml","Volume em ml (número inteiro)");
  addField("preco_reais",        "Novo preço em reais com até 2 casas decimais (ex: 4.90)");
  wi.addRow([]);
  addTitle("Regras importantes");
  addNote("[!] O produto é identificado por nome + marca + embalagem_tipo + embalagem_volume_ml");
  addNote("[!] Se o produto não for encontrado no catálogo, a linha é ignorada");
  addNote("[!] Preço zero ou negativo é ignorado");
  addNote("[!] Células com fórmulas (=, +, -, @) são REJEITADAS");
  addNote("[OK] Variações >= 15% geram alerta mas o preço é salvo normalmente");
  addNote("[OK] Apenas o preço é atualizado — os outros campos do produto não mudam");

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-precos-hubby.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
