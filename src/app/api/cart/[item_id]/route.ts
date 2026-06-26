import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── PATCH /api/cart/[item_id] — atualiza quantidade ─────────────────────────

const patchSchema = z.object({
  quantity: z.number().int().min(1).max(10_000),
});

export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const itemId = context?.params.item_id;
    if (!itemId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos" }, { status: 422 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { client_id: true },
    });
    if (!item || item.client_id !== client.id) {
      return Response.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data:  { quantity: parsed.data.quantity },
    });

    return Response.json({ item: updated });
  },
  { roles: ["client"] }
);

// ─── DELETE /api/cart/[item_id] — remove item ─────────────────────────────────

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const itemId = context?.params.item_id;
    if (!itemId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { client_id: true },
    });
    if (!item || item.client_id !== client.id) {
      return Response.json({ error: "Item não encontrado" }, { status: 404 });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    return Response.json({ ok: true });
  },
  { roles: ["client"] }
);
