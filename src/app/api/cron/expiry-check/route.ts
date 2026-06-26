import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notifyDistributorNearExpiry,
  notifyDistributorUrgentExpiry,
  notifyBuyerExpiryOffer,
} from "@/lib/notifications";

const URGENT_DAYS = 7;

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

/**
 * POST /api/cron/expiry-check
 *
 * Executar diariamente (ex: Vercel Cron Jobs às 07h00).
 * Protegido por CRON_SECRET no header Authorization.
 *
 * Passo 1 — Marca is_near_expiry e cria NearExpiryOffer automática
 * Passo 2 — Notifica distribuidoras (uma vez por lote, via expiry_notified_at)
 * Passo 3 — Notifica compradores favoritos quando urgente (≤7 dias, via urgency_notified_at)
 * Passo 4 — Desativa produtos vencidos
 */
export async function POST(req: NextRequest) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runExpiryCheck();
    console.log("[cron/expiry-check]", result);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/expiry-check]", err);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

// GET — teste manual em dev
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Não disponível em produção" }, { status: 403 });
  }
  return POST(req);
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function runExpiryCheck(): Promise<{
  marked_near_expiry: number;
  notified_distributors: number;
  notified_buyers: number;
  expired_deactivated: number;
}> {
  const now = new Date();

  // Carrega todos os produtos com expiry_date de distribuidoras Enterprise
  const products = await prisma.product.findMany({
    where: {
      expiry_date: { not: null },
      available: true,
      distributor: { plan: "enterprise" },
    },
    select: {
      id: true,
      name: true,
      expiry_date: true,
      expiry_alert_days: true,
      expiry_discount_pct: true,
      is_near_expiry: true,
      expiry_notified_at: true,
      urgency_notified_at: true,
      distributor_id: true,
      distributor: {
        select: {
          id: true,
          company_name: true,
          user: { select: { id: true } },
          favorited_by: {
            select: { client: { select: { user_id: true } } },
          },
        },
      },
    },
    take: 500,
  });

  const stats = {
    marked_near_expiry: 0,
    notified_distributors: 0,
    notified_buyers: 0,
    expired_deactivated: 0,
  };

  // Agrupa produtos por distribuidora para notificação em lote
  const distNewNearExpiry = new Map<string, { userId: string; names: string[] }>();

  await Promise.all(
    products.map(async (product) => {
      if (!product.expiry_date) return;

      const msLeft = product.expiry_date.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      // Produto vencido — desativa
      if (daysLeft <= 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: { available: false, is_near_expiry: false },
        });
        await prisma.nearExpiryOffer.updateMany({
          where: { product_id: product.id, active: true },
          data: { active: false },
        });
        stats.expired_deactivated++;
        return;
      }

      // Entra em alerta de vencimento
      if (daysLeft <= product.expiry_alert_days) {
        const discountPct = Math.round(product.expiry_discount_pct ?? 10);
        const expiryDate  = product.expiry_date;

        // Marca is_near_expiry e garante NearExpiryOffer ativo
        if (!product.is_near_expiry) {
          await prisma.product.update({
            where: { id: product.id },
            data: { is_near_expiry: true },
          });

          // Cria ou reativa NearExpiryOffer
          const existing = await prisma.nearExpiryOffer.findFirst({
            where: { product_id: product.id, distributor_id: product.distributor_id },
          });

          if (existing) {
            await prisma.nearExpiryOffer.update({
              where: { id: existing.id },
              data: { active: true, expires_at: expiryDate, discount_pct: discountPct },
            });
          } else {
            await prisma.nearExpiryOffer.create({
              data: {
                product_id:     product.id,
                distributor_id: product.distributor_id,
                expires_at:     expiryDate,
                discount_pct:   discountPct,
                stock:          999,
                active:         true,
              },
            });
          }

          stats.marked_near_expiry++;

          // Agrupa para notificar a distribuidora uma vez
          if (!product.expiry_notified_at) {
            const dist = distNewNearExpiry.get(product.distributor_id);
            if (dist) {
              dist.names.push(product.name);
            } else {
              distNewNearExpiry.set(product.distributor_id, {
                userId: product.distributor.user.id,
                names: [product.name],
              });
            }

            await prisma.product.update({
              where: { id: product.id },
              data: { expiry_notified_at: now },
            });
          }
        }

        // Alerta urgente — notifica compradores uma única vez
        if (daysLeft <= URGENT_DAYS && !product.urgency_notified_at) {
          await prisma.product.update({
            where: { id: product.id },
            data: { urgency_notified_at: now },
          });

          // Notifica distribuidora sobre urgência
          await notifyDistributorUrgentExpiry({
            distributor_user_id: product.distributor.user.id,
            product_name: product.name,
            days_left: daysLeft,
            product_id: product.id,
          }).catch((e) => console.error("[expiry-check] urgent notify dist:", e));

          // Notifica compradores que favoritaram a distribuidora
          const buyers = product.distributor.favorited_by;
          await Promise.all(
            buyers.map((fav) =>
              notifyBuyerExpiryOffer({
                buyer_user_id:    fav.client.user_id,
                distributor_name: product.distributor.company_name,
                product_name:     product.name,
                discount_pct:     discountPct,
                days_left:        daysLeft,
                product_id:       product.id,
              }).catch((e) => console.error("[expiry-check] buyer notify:", e))
            )
          );

          stats.notified_buyers += buyers.length;
        }
      }
    })
  );

  // Notificação em lote para distribuidoras com novos produtos near-expiry
  for (const [, { userId, names }] of distNewNearExpiry) {
    await notifyDistributorNearExpiry({
      distributor_user_id: userId,
      product_count: names.length,
      product_names: names,
    }).catch((e) => console.error("[expiry-check] batch notify dist:", e));
    stats.notified_distributors++;
  }

  return stats;
}
