import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  active: z.boolean(),
});

/**
 * PATCH /api/admin/cobertura/:id — toggle cidade ativa/inativa
 * DELETE /api/admin/cobertura/:id — remove cidade
 */

export const PATCH = withAuth(
  async (req: NextRequest, _user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID ausente" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const updated = await prisma.coverageCity.update({
      where: { id },
      data: { active: parsed.data.active },
    });

    return Response.json(updated);
  },
  { roles: ["platform_admin"] }
);

export const DELETE = withAuth(
  async (_req: NextRequest, _user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID ausente" }, { status: 400 });

    await prisma.coverageCity.delete({ where: { id } });
    return Response.json({ ok: true });
  },
  { roles: ["platform_admin"] }
);
