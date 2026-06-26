import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    role_label:                 z.enum(["vendedor", "supervisor", "atendimento"]).optional(),
    role_scope:                 z.enum(["all_clients", "assigned_clients"]).optional(),
    assigned_client_ids:        z.array(z.string().uuid()).optional(),
    sales_target_monthly_cents: z.number().int().positive().nullable().optional(),
    status:                     z.enum(["active", "inactive"]).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualizar",
  });

export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const memberId = context?.params.id;
    if (!memberId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId }, select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    const member = await prisma.distributorTeamMember.findFirst({
      where: { id: memberId, distributor_id: distributor.id },
    });
    if (!member) return Response.json({ error: "Membro não encontrado" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const updated = await prisma.distributorTeamMember.update({
      where: { id: memberId },
      data: {
        ...(parsed.data.role_label                 !== undefined && { role_label: parsed.data.role_label }),
        ...(parsed.data.role_scope                 !== undefined && { role_scope: parsed.data.role_scope }),
        ...(parsed.data.assigned_client_ids        !== undefined && { assigned_client_ids: parsed.data.assigned_client_ids }),
        ...(parsed.data.sales_target_monthly_cents !== undefined && { sales_target_monthly_cents: parsed.data.sales_target_monthly_cents }),
        ...(parsed.data.status                     !== undefined && { status: parsed.data.status }),
      },
    });

    return Response.json({ member: updated });
  },
  { roles: ["distributor_admin"] }
);

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const memberId = context?.params.id;
    if (!memberId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId }, select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    const member = await prisma.distributorTeamMember.findFirst({
      where: { id: memberId, distributor_id: distributor.id },
    });
    if (!member) return Response.json({ error: "Membro não encontrado" }, { status: 404 });

    await prisma.distributorTeamMember.delete({ where: { id: memberId } });
    return Response.json({ ok: true });
  },
  { roles: ["distributor_admin"] }
);
