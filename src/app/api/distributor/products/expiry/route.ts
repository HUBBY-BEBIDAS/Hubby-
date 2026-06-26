import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/products/expiry
 *
 * Lista todos os produtos da distribuidora Enterprise com configuração de
 * vencimento, ordenados por data de vencimento ascendente.
 * Retorna erro 403 para distribuidoras não-Enterprise.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }
    if (distributor.plan !== "enterprise") {
      return Response.json({ error: "Recurso exclusivo do plano Enterprise" }, { status: 403 });
    }

    const products = await prisma.product.findMany({
      where: { distributor_id: distributor.id },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        packaging_type: true,
        packaging_volume_ml: true,
        price_cents: true,
        available: true,
        image_url: true,
        expiry_date: true,
        expiry_alert_days: true,
        expiry_discount_pct: true,
        is_near_expiry: true,
        expiry_notified_at: true,
        urgency_notified_at: true,
      },
      orderBy: [
        { expiry_date: { sort: "asc", nulls: "last" } },
        { name: "asc" },
      ],
    });

    const now = Date.now();

    const enriched = products.map((p) => {
      const daysLeft =
        p.expiry_date
          ? Math.ceil((p.expiry_date.getTime() - now) / (1000 * 60 * 60 * 24))
          : null;

      let status: "ok" | "attention" | "urgent" | "expired" = "ok";
      if (daysLeft !== null) {
        if (daysLeft <= 0)                   status = "expired";
        else if (daysLeft <= 7)              status = "urgent";
        else if (daysLeft <= p.expiry_alert_days) status = "attention";
      }

      return { ...p, days_left: daysLeft, expiry_status: status };
    });

    return Response.json({ products: enriched });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
