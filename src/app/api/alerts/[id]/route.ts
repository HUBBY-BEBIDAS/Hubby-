import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/alerts/:id
 * Remove um alerta de preço do comprador autenticado.
 */
export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const alertId = context?.params.id;
    if (!alertId) return Response.json({ error: "ID obrigatório" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const alert = await prisma.priceAlert.findFirst({
      where: { id: alertId, client_id: client.id },
    });
    if (!alert) return Response.json({ error: "Alerta não encontrado" }, { status: 404 });

    await prisma.priceAlert.delete({ where: { id: alertId } });
    return Response.json({ ok: true });
  },
  { roles: ["client"] }
);
