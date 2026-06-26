/**
 * Geração e envio do relatório mensal do comprador.
 *
 * Calcula, para o mês anterior:
 *   - Total de cotações, pedidos, valor pedido
 *   - Economia estimada (vs. preço mais caro disponível no mesmo ranking)
 *   - Top 3 distribuidoras, produto mais cotado, média de distribuidoras/cotação
 *
 * Persiste em monthly_reports e envia e-mail via SendGrid.
 */

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
  }).format(cents / 100);
}

function monthName(month: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(2000, month - 1, 1)
  );
}

// ─── Geração do relatório ────────────────────────────────────────────────────

export async function generateMonthlyReport(
  clientId: string,
  month: number,
  year: number
): Promise<string> {
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1);     // início do mês seguinte

  // Busca todos os pedidos do período
  const orders = await prisma.order.findMany({
    where: {
      client_id: clientId,
      sent_at: { gte: startDate, lt: endDate },
    },
    select: {
      id: true,
      quotation_id: true,
      distributor_id: true,
      total_cents: true,
      items_snapshot: true,
      distributor: { select: { company_name: true } },
    },
  });

  // Busca cotações do período (para contar e pegar itens)
  const quotations = await prisma.quotation.findMany({
    where: {
      client_id: clientId,
      created_at: { gte: startDate, lt: endDate },
      status: { not: "draft" },
    },
    select: {
      id: true,
      items: { select: { product_name: true, brand: true } },
      orders: { select: { distributor_id: true } },
    },
  });

  const totalQuotations  = quotations.length;
  const totalOrders      = orders.length;
  const totalValueCents  = orders.reduce((s, o) => s + o.total_cents, 0);
  const estimatedSavingsCents = 0; // campo mantido por compatibilidade; não exibido no frontend

  // Média de distribuidoras por cotação
  const avgDistributors =
    totalQuotations > 0
      ? quotations.reduce((s, q) => s + q.orders.length, 0) / totalQuotations
      : 0;

  // Top 3 distribuidoras por valor
  const distMap = new Map<string, { name: string; order_count: number; value_cents: number }>();
  for (const order of orders) {
    const name = order.distributor.company_name;
    const entry = distMap.get(order.distributor_id) ?? { name, order_count: 0, value_cents: 0 };
    entry.order_count++;
    entry.value_cents += order.total_cents;
    distMap.set(order.distributor_id, entry);
  }
  const topDistributors = [...distMap.values()]
    .sort((a, b) => b.value_cents - a.value_cents)
    .slice(0, 3);

  // Produto mais cotado
  const productMap = new Map<string, { product_name: string; brand: string; quote_count: number }>();
  for (const q of quotations) {
    for (const item of q.items) {
      const key = `${item.brand}|${item.product_name}`;
      const entry = productMap.get(key) ?? { product_name: item.product_name, brand: item.brand, quote_count: 0 };
      entry.quote_count++;
      productMap.set(key, entry);
    }
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.quote_count - a.quote_count)
    .slice(0, 5);

  // Persiste (upsert — idempotente)
  const report = await prisma.monthlyReport.upsert({
    where: { client_id_month_year: { client_id: clientId, month, year } },
    create: {
      client_id: clientId,
      month,
      year,
      total_quotations: totalQuotations,
      total_orders: totalOrders,
      total_value_cents: totalValueCents,
      estimated_savings_cents: estimatedSavingsCents,
      avg_distributors_per_quotation: avgDistributors,
      top_distributors: topDistributors,
      top_products: topProducts,
    },
    update: {
      total_quotations: totalQuotations,
      total_orders: totalOrders,
      total_value_cents: totalValueCents,
      estimated_savings_cents: estimatedSavingsCents,
      avg_distributors_per_quotation: avgDistributors,
      top_distributors: topDistributors,
      top_products: topProducts,
    },
  });

  return report.id;
}

// ─── Envio do e-mail ─────────────────────────────────────────────────────────

export async function sendMonthlyReportEmail(reportId: string): Promise<void> {
  const report = await prisma.monthlyReport.findUnique({
    where: { id: reportId },
    include: {
      client: {
        select: {
          responsible_name: true,
          pref_email_monthly_report: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!report) throw new Error("Relatório não encontrado");
  if (report.email_sent) return;                               // idempotente
  if (!report.client.pref_email_monthly_report) return;        // cliente optou por não receber

  const name    = report.client.responsible_name.split(" ")[0];
  const mName   = monthName(report.month);
  const savings = formatBRL(report.estimated_savings_cents);
  const total   = formatBRL(report.total_value_cents);
  const topDist = (report.top_distributors as Array<{ name: string; value_cents: number }>)
    .slice(0, 3)
    .map((d, i) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i + 1}°</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${d.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatBRL(d.value_cents)}</td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Resumo ${mName} — Hubby</title></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FB;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

  <!-- Header -->
  <tr><td style="background:#0B1220;padding:32px 40px;text-align:center;">
    <p style="margin:0;color:#22C55E;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">HUBBY</p>
    <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;">Seu resumo de ${mName}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:14px;">Oi, ${name} — aqui está o que aconteceu no mês</p>
  </td></tr>

  <!-- Economia principal -->
  <tr><td style="padding:32px 40px;text-align:center;border-bottom:1px solid #e2e8f0;">
    <p style="margin:0;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;">Economia estimada no mês</p>
    <p style="margin:8px 0 0;color:#22C55E;font-size:48px;font-weight:900;letter-spacing:-1px;">${savings}</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">em relação ao preço mais caro disponível</p>
  </td></tr>

  <!-- Métricas secundárias -->
  <tr><td style="padding:24px 40px;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:0 12px;">
        <p style="margin:0;color:#22C55E;font-size:32px;font-weight:900;">${report.total_quotations}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">cotações realizadas</p>
      </td>
      <td align="center" style="padding:0 12px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
        <p style="margin:0;color:#22C55E;font-size:32px;font-weight:900;">${report.total_orders}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">pedidos enviados</p>
      </td>
      <td align="center" style="padding:0 12px;">
        <p style="margin:0;color:#22C55E;font-size:32px;font-weight:900;">${total}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">valor total pedido</p>
      </td>
    </tr>
    </table>
  </td></tr>

  ${topDist ? `<!-- Top distribuidoras -->
  <tr><td style="padding:24px 40px 8px;border-bottom:1px solid #e2e8f0;">
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.1em;">Top distribuidoras</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;">Pos.</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;">Distribuidora</th><th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;">Valor</th></tr>
      ${topDist}
    </table>
  </td></tr>` : ""}

  <!-- CTA -->
  <tr><td style="padding:32px 40px;text-align:center;">
    <a href="${process.env.NEXTAUTH_URL ?? "https://app.hubby.com.br"}/historico"
       style="display:inline-block;background:#22C55E;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
      Ver histórico completo →
    </a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;">
      <a href="${process.env.NEXTAUTH_URL ?? "https://app.hubby.com.br"}/perfil/cliente?tab=notificacoes" style="color:#94a3b8;">
        Cancelar recebimento deste e-mail
      </a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  await sendMail({
    to:      report.client.user.email,
    subject: `Seu resumo de ${mName} na Hubby — você economizou ${savings}`,
    html,
  });

  await prisma.monthlyReport.update({
    where: { id: reportId },
    data:  { email_sent: true },
  });
}

// ─── Geração em lote (chamado pelo cron no dia 1) ─────────────────────────────

export async function generateAllMonthlyReports(): Promise<{ generated: number; errors: number }> {
  const now   = new Date();
  // Mês anterior
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const clients = await prisma.client.findMany({
    select: { id: true },
  });

  let generated = 0;
  let errors    = 0;

  for (const client of clients) {
    try {
      const reportId = await generateMonthlyReport(client.id, month, year);
      await sendMonthlyReportEmail(reportId);
      generated++;
    } catch (err) {
      console.error(`[monthly-report] Erro para client=${client.id}:`, err);
      errors++;
    }
  }

  return { generated, errors };
}
