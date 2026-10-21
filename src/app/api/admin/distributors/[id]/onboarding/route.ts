import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import type { OnboardingStatus } from "@prisma/client";

const bodySchema = z.object({
  status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO"]),
});

/**
 * PATCH /api/admin/distributors/[id]/onboarding
 *
 * Atualiza o campo onboarding_status de uma distribuidora.
 * Requer role platform_admin.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Status inválido", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { id },
      select: { id: true, company_name: true, plan: true, onboarding_status: true },
    });

    if (!distributor) {
      return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });
    }

    const previousStatus = distributor.onboarding_status;
    const newStatus      = parsed.data.status as OnboardingStatus;

    if (previousStatus === newStatus) {
      return Response.json({ message: "Status já é o mesmo, nenhuma alteração feita." });
    }

    await prisma.distributor.update({
      where: { id },
      data:  { onboarding_status: newStatus },
    });

    console.log(
      `[admin/onboarding] Admin ${user.userId} alterou onboarding_status de "${distributor.company_name}" ` +
      `de ${previousStatus} para ${newStatus}`
    );

    return Response.json({
      ok:       true,
      id,
      previous: previousStatus,
      current:  newStatus,
    });
  },
  { roles: ["platform_admin"] }
);
