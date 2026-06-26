import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/onboarding
 * Retorna o estado atual do onboarding da distribuidora.
 *
 * PATCH /api/distributor/onboarding
 * Atualiza o passo atual ou marca o onboarding como concluído.
 */

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        company_name: true,
        onboarding_completed: true,
        onboarding_step: true,
        credit_score_minimum: true,
        credit_accepts_restrictions: true,
        credit_min_cnpj_months: true,
        _count: {
          select: {
            products: { where: { available: true } },
            delivery_regions: true,
          },
        },
      },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    return Response.json({
      onboarding_completed: distributor.onboarding_completed,
      onboarding_step:      distributor.onboarding_step,
      company_name:         distributor.company_name,
      has_products:         distributor._count.products > 0,
      has_regions:          distributor._count.delivery_regions > 0,
      products_count:       distributor._count.products,
      regions_count:        distributor._count.delivery_regions,
      credit_score_minimum: distributor.credit_score_minimum,
      credit_accepts_restrictions: distributor.credit_accepts_restrictions,
      credit_min_cnpj_months: distributor.credit_min_cnpj_months,
    });
  },
  { roles: ["distributor_admin"] }
);

const patchSchema = z.object({
  step:      z.number().int().min(1).max(5).optional(),
  completed: z.boolean().optional(),
  // Critério de crédito (passo 4)
  credit_score_minimum:        z.number().int().min(0).max(1000).optional(),
  credit_accepts_restrictions: z.boolean().optional(),
  credit_min_cnpj_months:      z.number().int().min(0).max(120).optional(),
});

export const PATCH = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.step      !== undefined) data.onboarding_step      = parsed.data.step;
    if (parsed.data.completed !== undefined) data.onboarding_completed = parsed.data.completed;
    if (parsed.data.credit_score_minimum        !== undefined) data.credit_score_minimum        = parsed.data.credit_score_minimum;
    if (parsed.data.credit_accepts_restrictions !== undefined) data.credit_accepts_restrictions = parsed.data.credit_accepts_restrictions;
    if (parsed.data.credit_min_cnpj_months      !== undefined) data.credit_min_cnpj_months      = parsed.data.credit_min_cnpj_months;

    await prisma.distributor.update({ where: { id: distributor.id }, data });

    return Response.json({ ok: true });
  },
  { roles: ["distributor_admin"] }
);
