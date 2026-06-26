import ExcelJS from "exceljs";
import { withAuth } from "@/lib/with-auth";
import { NextRequest } from "next/server";

const HEADERS = [
  { key: "cidade",              header: "cidade",              width: 24 },
  { key: "estado",              header: "estado",              width: 10 },
  { key: "prazo_dias_uteis",    header: "prazo_dias_uteis",    width: 20 },
  { key: "horario_corte",       header: "horario_corte",       width: 18 },
  { key: "pedido_minimo_reais", header: "pedido_minimo_reais", width: 22 },
  { key: "dias_rota",           header: "dias_rota",           width: 24 },
];

const EXAMPLES = [
  ["Sao Paulo",       "SP", 1, "15:00",  0,   "seg,qua,sex"],
  ["Santo Andre",     "SP", 2, "12:00",  500, "ter,qui"],
  ["Campinas",        "SP", 2, "14:00",  300, "seg,qua,sex"],
  ["Ribeirao Preto",  "SP", 3, "11:00",  800, "ter,sex"],
  ["Santos",          "SP", 2, "13:00",  400, "qua,sex"],
];

export const GET = withAuth(async (_req: NextRequest, user) => {
  if (!["distributor_admin", "distributor_collaborator", "platform_admin"].includes(user.role)) {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hubby";
  wb.created = new Date();

  // ── Aba Roteiros ──────────────────────────────────────────────
  const ws = wb.addWorksheet("Roteiros");

  ws.columns = HEADERS.map(({ key, header, width }) => ({ key, header, width }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF15803D" } } };
  });
  headerRow.height = 22;

  EXAMPLES.forEach((row) => {
    const added = ws.addRow(row);
    added.eachCell((cell) => { cell.alignment = { vertical: "middle" }; });
  });

  ws.getColumn("pedido_minimo_reais").numFmt = "#,##0.00";
  ws.getColumn("pedido_minimo_reais").alignment = { horizontal: "right" };
  ws.getColumn("prazo_dias_uteis").numFmt = "0";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Aba Instruções ────────────────────────────────────────────
  const wi = wb.addWorksheet("Instrucoes");
  wi.columns = [{ width: 26 }, { width: 72 }];

  function addTitle(text: string) {
    const r = wi.addRow([text]);
    r.getCell(1).font = { bold: true, size: 13, color: { argb: "FF16A34A" } };
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

  addTitle("Como preencher a planilha de roteiros");

  addField("Coluna", "Descrição");
  wi.lastRow!.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
  });
  addSeparator();

  addField("cidade",              "Nome da cidade  (ex: Sao Paulo, Santo Andre)");
  addField("estado",              "Sigla do estado com 2 letras  (ex: SP, RJ, MG)");
  addField("prazo_dias_uteis",    "Quantos dias úteis até a entrega  (ex: 1, 2, 3)");
  addField("horario_corte",       "Horário limite para pedidos do dia, no formato HH:MM  (ex: 15:00, 12:30)");
  addField("pedido_minimo_reais", "Valor mínimo do pedido em reais — use 0 se não houver mínimo  (ex: 0, 300, 500)");
  addField("dias_rota",           "Dias da semana em que a rota passa, separados por vírgula  (ex: seg,qua,sex)");

  addSeparator();
  addTitle("Valores válidos para dias_rota");

  const diasValidos = [
    ["seg", "Segunda-feira"],
    ["ter", "Terça-feira"],
    ["qua", "Quarta-feira"],
    ["qui", "Quinta-feira"],
    ["sex", "Sexta-feira"],
    ["sab", "Sábado"],
  ];
  diasValidos.forEach(([abbr, label]) => addField(abbr, label));

  addSeparator();
  addNote("Exemplo de dias_rota:  seg,qua,sex  →  rota nas segundas, quartas e sextas");
  addNote("Exemplo de dias_rota:  ter,qui  →  rota nas terças e quintas");

  addSeparator();
  addTitle("Regras importantes");

  addNote("[!] Células com fórmulas serão REJEITADAS (não comece com =, +, - ou @)");
  addNote("[!] Linhas com o texto FORA DE ROTA na coluna cidade são ignoradas automaticamente");
  addNote("[!] O horário de corte deve estar no formato HH:MM  (ex: 09:00, 15:30)");
  addNote("[!] Não altere os nomes das colunas na linha 1 da aba Roteiros");
  addNote("[OK] Linhas com erros são ignoradas — as demais são importadas normalmente");
  addNote("[OK] Se a cidade já existir, os dados serão atualizados");

  addSeparator();
  addTitle("Formato alternativo aceito");

  addNote("O sistema também aceita planilhas de roteiro semanal com o formato:");
  addNote("CIDADE | SEGUNDA-FEIRA | TERÇA-FEIRA | QUARTA-FEIRA | QUINTA-FEIRA | SEXTA-FEIRA | SÁBADO");
  addNote("Nesse formato, preencha SIM nas colunas dos dias em que a rota passa.");
  addNote("Linhas com FORA DE ROTA em qualquer dia são ignoradas automaticamente.");

  addSeparator();
  addTitle("Exemplos de preenchimento correto");

  const exHeader = wi.addRow(["cidade | estado | prazo | corte | minimo | dias_rota"]);
  exHeader.getCell(1).font = { bold: true, color: { argb: "FF16A34A" } };

  EXAMPLES.forEach(([cidade, estado, prazo, corte, minimo, dias]) => {
    addNote(`${cidade} | ${estado} | ${prazo} | ${corte} | ${minimo} | ${dias}`);
  });

  // ── Serializar e retornar ─────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-roteiros-hubby.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
