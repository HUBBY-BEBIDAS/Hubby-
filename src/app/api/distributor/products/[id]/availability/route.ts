import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";

const availabilitySchema = z.object({
  available: z.boolean(),
});

/**
 * PATCH /api/distributor/products/:id/availability
 *
 * Liga/desliga a disponibilidade de um produto.
 * Produtos indisponíveis não aparecem no ranking.
 * Invalida o cache de ranking ao alterar.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const productId = context?.params.id;
    if (!productId) {
      return Response.json({ error: "ID não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = availabilitySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Envie { available: true } ou { available: false }" },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, distributor_id: distributor.id },
    });
    if (!product) {
      return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { available: parsed.data.available },
    });

    // Qualquer mudança de disponibilidade invalida o ranking (produto pode entrar/sair)
    await markDistributorProductsUpdated(distributor.id);

    return Response.json({
      product: updated,
      message: parsed.data.available ? "Produto ativado" : "Produto desativado",
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
