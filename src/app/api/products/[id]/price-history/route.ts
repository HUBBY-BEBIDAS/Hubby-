import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/products/:id/price-history?distributor_id=X
 *
 * Retorna as últimas 10 entradas de histórico de preço de um produto
 * para uma distribuidora específica, vistas pelo cliente autenticado.
 *
 * Usado pelo ranking para exibir o indicador ↑↓— com tooltip.
 */
export const GET = withAuth(
  async (req: NextRequest, user, context) => {
    const productId     = context?.params.id;
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get("distributor_id");

    if (!productId || !distributorId) {
      return Response.json({ error: "product_id e distributor_id obrigatórios" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const history = await prisma.priceHistory.findMany({
      where: {
        product_id:     productId,
        distributor_id: distributorId,
        client_id:      client.id,
      },
      orderBy: { recorded_at: "desc" },
      take: 10,
      select: {
        id: true,
        price_cents: true,
        recorded_at: true,
      },
    });

    return Response.json({ history });
  },
  { roles: ["client"] }
);
