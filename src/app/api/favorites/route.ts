import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/favorites — lista favoritos do comprador ────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const favorites = await prisma.favoriteDistributor.findMany({
      where: { client_id: client.id },
      include: {
        distributor: {
          select: {
            id: true,
            company_name: true,
            average_rating: true,
            review_count: true,
            whatsapp_commercial: true,
            email_commercial: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Última compra de cada distribuidora favorita
    const enriched = await Promise.all(
      favorites.map(async (f) => {
        const lastOrder = await prisma.order.findFirst({
          where: { client_id: client.id, distributor_id: f.distributor_id },
          orderBy: { sent_at: "desc" },
          select: { sent_at: true, total_cents: true },
        });
        return { ...f, last_order: lastOrder ?? null };
      })
    );

    return Response.json({ favorites: enriched });
  },
  { roles: ["client"] }
);
