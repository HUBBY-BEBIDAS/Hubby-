import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/distributors/:id/approve
 *
 * Admin aprova (ou revoga aprovação de) uma distribuidora.
 *
 * Body:
 *   approved: boolean
 *
 * Ao aprovar: distribuidora passa a aparecer no ranking de cotações.
 * Ao revogar: some do ranking imediatamente.
 */
export const PATCH = withAuth(
  async (req: NextRequest, _user, context) => {
    const id = context?.params.id;
    if (!id) {
      return Response.json({ error: "ID da distribuidora não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    if (typeof b.approved !== "boolean") {
      return Response.json(
        { error: "Campo 'approved' (boolean) é obrigatório" },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { id },
      select: { id: true, company_name: true, approved_by_admin: true },
    });
    if (!distributor) {
      return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });
    }

    if (distributor.approved_by_admin === b.approved) {
      return Response.json(
        {
          message: `Distribuidora já está ${b.approved ? "aprovada" : "não aprovada"}`,
          distributor: { id, approved_by_admin: b.approved },
        }
      );
    }

    const updated = await prisma.distributor.update({
      where: { id },
      data: { approved_by_admin: b.approved },
      select: {
        id: true,
        company_name: true,
        cnpj: true,
        approved_by_admin: true,
        plan: true,
        plan_status: true,
      },
    });

    return Response.json({
      message: b.approved
        ? `Distribuidora "${distributor.company_name}" aprovada com sucesso.`
        : `Aprovação da distribuidora "${distributor.company_name}" revogada.`,
      distributor: updated,
    });
  },
  { roles: ["platform_admin"] }
);
