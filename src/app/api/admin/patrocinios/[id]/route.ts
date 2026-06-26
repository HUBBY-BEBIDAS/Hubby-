import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/patrocinios/:id
 * Ativa ou desativa um slot de patrocínio manualmente.
 */
export const PATCH = withAuth(
  async (req: NextRequest, _user, context) => {
    const slotId = context?.params.id;
    if (!slotId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: { active?: boolean };
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    if (typeof body.active !== "boolean") {
      return Response.json({ error: "Informe o campo 'active'" }, { status: 422 });
    }

    const slot = await prisma.sponsoredSlot.findUnique({ where: { id: slotId } });
    if (!slot) return Response.json({ error: "Slot não encontrado" }, { status: 404 });

    const updated = await prisma.sponsoredSlot.update({
      where: { id: slotId },
      data:  { active: body.active },
    });

    return Response.json({ slot: updated });
  },
  { roles: ["platform_admin"] }
);
