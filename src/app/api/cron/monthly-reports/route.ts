import { NextRequest } from "next/server";
import { generateAllMonthlyReports } from "@/lib/monthly-report";

/**
 * POST /api/cron/monthly-reports
 *
 * Endpoint disparado pelo cron no dia 1 de cada mês (ex: Vercel Cron Jobs).
 * Protegido por CRON_SECRET no header Authorization.
 *
 * Gera o relatório do mês anterior para todos os compradores e envia e-mail
 * para os que têm a preferência ativada.
 */
export async function POST(req: NextRequest) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await generateAllMonthlyReports();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/monthly-reports]", err);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

// GET — para teste manual no dev (sem autenticação em dev, bloqueado em prod)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Não disponível" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (clientId) {
    const { generateMonthlyReport, sendMonthlyReportEmail } = await import("@/lib/monthly-report");
    const now   = new Date();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const id    = await generateMonthlyReport(clientId, month, year);
    await sendMonthlyReportEmail(id);
    return Response.json({ ok: true, report_id: id });
  }

  const result = await generateAllMonthlyReports();
  return Response.json({ ok: true, ...result });
}
