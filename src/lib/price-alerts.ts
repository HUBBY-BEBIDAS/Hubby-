/**
 * Verifica alertas de preço e notifica compradores quando o preço cai.
 *
 * Dois fluxos:
 *  1. PriceAlert explícito — comprador criou um alerta via /api/alerts
 *  2. Cotações recentes — comprador cotou o produto nos últimos 30 dias
 *     e a queda é >= 10% (independentemente de ter alerta ativo)
 */

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendMail } from "@/lib/mailer";
import type { ProductCategory } from "@prisma/client";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatPct(from: number, to: number): string {
  return Math.round(((from - to) / from) * 100) + "%";
}

export async function checkAndFirePriceAlerts(opts: {
  brand: string;
  category: ProductCategory | string;
  new_price_cents: number;
  previous_price_cents: number;
  distributor_name: string;
  distributor_id: string;
}): Promise<void> {
  const drop = opts.previous_price_cents - opts.new_price_cents;
  const dropPct = (drop / opts.previous_price_cents) * 100;

  const notifiedClientIds = new Set<string>();

  // ── Fluxo 1: PriceAlerts explícitos ─────────────────────────────────────────
  const alerts = await prisma.priceAlert.findMany({
    where: {
      brand:    { equals: opts.brand, mode: "insensitive" },
      category: opts.category,
    },
    include: {
      client: {
        select: {
          id: true,
          responsible_name: true,
          pref_email_price_alerts: true,
          user: { select: { id: true, email: true } },
        },
      },
    },
  });

  for (const alert of alerts) {
    const shouldNotify =
      alert.last_seen_price_cents === null ||
      opts.new_price_cents < alert.last_seen_price_cents;
    if (!shouldNotify) continue;

    notifiedClientIds.add(alert.client.id);

    await Promise.allSettled([
      prisma.priceAlert.update({
        where: { id: alert.id },
        data:  { last_seen_price_cents: opts.new_price_cents },
      }),
      createNotification({
        user_id: alert.client.user.id,
        type:    "price_drop",
        title:   "Queda de preço detectada",
        body:    `${opts.brand} (${opts.category}) caiu ${formatPct(opts.previous_price_cents, opts.new_price_cents)} para ${formatBRL(opts.new_price_cents)} na ${opts.distributor_name}.`,
        data: {
          brand: opts.brand, category: opts.category,
          new_price_cents: opts.new_price_cents,
          distributor_name: opts.distributor_name,
        },
      }),
      // E-mail se preferência ativada
      alert.client.pref_email_price_alerts
        ? sendMail({
            to:      alert.client.user.email,
            subject: `[Queda de preco] ${opts.brand} caiu ${formatPct(opts.previous_price_cents, opts.new_price_cents)} — aproveite agora`,
            html: buildPriceDropEmail({
              name:             alert.client.responsible_name.split(" ")[0],
              brand:            opts.brand,
              distributor_name: opts.distributor_name,
              new_price:        formatBRL(opts.new_price_cents),
              drop_pct:         formatPct(opts.previous_price_cents, opts.new_price_cents),
            }),
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  }

  // ── Fluxo 2: Cotações recentes (queda >= 10%, últimos 30 dias) ───────────────
  if (dropPct < 10) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentQuotationItems = await prisma.quotationItem.findMany({
    where: {
      brand:    { equals: opts.brand, mode: "insensitive" },
      category: opts.category as ProductCategory,
      quotation: {
        created_at: { gte: thirtyDaysAgo },
        status: { not: "draft" },
      },
    },
    select: {
      quotation: {
        select: {
          client: {
            select: {
              id: true,
              responsible_name: true,
              pref_email_price_alerts: true,
              user: { select: { id: true, email: true } },
            },
          },
        },
      },
    },
    distinct: ["quotation_id"],
  });

  for (const qi of recentQuotationItems) {
    const client = qi.quotation.client;
    if (notifiedClientIds.has(client.id)) continue; // já notificado pelo fluxo 1
    notifiedClientIds.add(client.id);

    await Promise.allSettled([
      createNotification({
        user_id: client.user.id,
        type:    "price_drop",
        title:   "Preço caiu — produto que você cotou",
        body:    `${opts.brand} (${opts.category}) caiu ${formatPct(opts.previous_price_cents, opts.new_price_cents)} para ${formatBRL(opts.new_price_cents)} na ${opts.distributor_name}. Você cotou este produto recentemente.`,
        data: {
          brand: opts.brand, category: opts.category,
          new_price_cents: opts.new_price_cents,
          distributor_name: opts.distributor_name,
        },
      }),
      client.pref_email_price_alerts
        ? sendMail({
            to:      client.user.email,
            subject: `[Queda de preco] ${opts.brand} caiu ${formatPct(opts.previous_price_cents, opts.new_price_cents)} — você cotou este produto`,
            html: buildPriceDropEmail({
              name:             client.responsible_name.split(" ")[0],
              brand:            opts.brand,
              distributor_name: opts.distributor_name,
              new_price:        formatBRL(opts.new_price_cents),
              drop_pct:         formatPct(opts.previous_price_cents, opts.new_price_cents),
            }),
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  }
}

function buildPriceDropEmail(opts: {
  name: string; brand: string; distributor_name: string; new_price: string; drop_pct: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Queda de preço — Hubby</title></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#0B1220;padding:28px 32px;text-align:center;">
    <p style="margin:0;color:#22C55E;font-size:11px;font-weight:700;letter-spacing:0.2em;">HUBBY</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:20px;">Preco caiu!</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.55);font-size:13px;">Oi, ${opts.name} — uma oportunidade para você</p>
  </td></tr>
  <tr><td style="padding:28px 32px;text-align:center;border-bottom:1px solid #e2e8f0;">
    <p style="margin:0;font-size:13px;color:#64748b;">${opts.brand} caiu</p>
    <p style="margin:8px 0;font-size:40px;font-weight:900;color:#22C55E;">${opts.drop_pct}</p>
    <p style="margin:0;font-size:14px;color:#0f172a;">Novo preço: <strong>${opts.new_price}</strong> em ${opts.distributor_name}</p>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;">
    <a href="${process.env.NEXTAUTH_URL ?? "https://app.hubby.com.br"}/cotacao"
       style="display:inline-block;background:#22C55E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;">
      Cotar agora →
    </a>
    <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">
      <a href="${process.env.NEXTAUTH_URL ?? "https://app.hubby.com.br"}/perfil/cliente?tab=notificacoes" style="color:#94a3b8;">Cancelar alertas de preço</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
