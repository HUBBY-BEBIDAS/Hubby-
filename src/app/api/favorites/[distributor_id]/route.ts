import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── POST /api/favorites/:distributor_id — adiciona favorito ─────────────────

export const POST = withAuth(
  async (_req: NextRequest, user, context) => {
    const distributorId = context?.params.distributor_id;
    if (!distributorId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const distributor = await prisma.distributor.findUnique({
      where: { id: distributorId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    const fav = await prisma.favoriteDistributor.upsert({
      where: { client_id_distributor_id: { client_id: client.id, distributor_id: distributorId } },
      create: { client_id: client.id, distributor_id: distributorId },
      update: {},
    });

    return Response.json({ favorite: fav }, { status: 201 });
  },
  { roles: ["client"] }
);

// ─── DELETE /api/favorites/:distributor_id — remove favorito ─────────────────

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const distributorId = context?.params.distributor_id;
    if (!distributorId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    await prisma.favoriteDistributor.deleteMany({
      where: { client_id: client.id, distributor_id: distributorId },
    });

    return Response.json({ message: "Removido dos favoritos" });
  },
  { roles: ["client"] }
);
