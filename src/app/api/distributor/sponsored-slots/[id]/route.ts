import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  ends_at:      z.string().datetime({ offset: true }).optional(),
  budget_cents: z.number().int().positive().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: "Informe ao menos um campo para atualizar",
});

export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const slotId = context?.params.id;
    if (!slotId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId }, select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    const slot = await prisma.sponsoredSlot.findFirst({
      where: { id: slotId, distributor_id: distributor.id },
    });
    if (!slot) return Response.json({ error: "Slot não encontrado" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const updated = await prisma.sponsoredSlot.update({
      where: { id: slotId },
      data: {
        ...(parsed.data.ends_at      && { ends_at:      new Date(parsed.data.ends_at) }),
        ...(parsed.data.budget_cents && { budget_cents: parsed.data.budget_cents }),
      },
    });

    return Response.json({ slot: updated });
  },
  { roles: ["distributor_admin"] }
);

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const slotId = context?.params.id;
    if (!slotId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId }, select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    const slot = await prisma.sponsoredSlot.findFirst({
      where: { id: slotId, distributor_id: distributor.id },
    });
    if (!slot) return Response.json({ error: "Slot não encontrado" }, { status: 404 });
    if (slot.active) return Response.json({ error: "Não é possível remover um slot ativo. Contate o suporte." }, { status: 422 });

    await prisma.sponsoredSlot.delete({ where: { id: slotId } });
    return Response.json({ ok: true });
  },
  { roles: ["distributor_admin"] }
);
