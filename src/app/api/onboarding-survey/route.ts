import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const surveySchema = z.object({
  orders_per_month:    z.string().optional(),
  monthly_spend_range: z.string().optional(),
  distributors_count:  z.string().optional(),
  referral_source:     z.string().optional(),
  main_pain:           z.string().optional(),
  beverage_types:      z.array(z.string()).default([]),
  skipped:             z.boolean().default(false),
});

/**
 * POST /api/onboarding-survey
 * Salva ou atualiza a pesquisa de onboarding do comprador.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = surveySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const d = parsed.data;
    const now = new Date();

    const survey = await prisma.onboardingSurvey.upsert({
      where:  { client_id: client.id },
      create: {
        client_id:           client.id,
        orders_per_month:    d.skipped ? null : (d.orders_per_month    ?? null),
        monthly_spend_range: d.skipped ? null : (d.monthly_spend_range ?? null),
        distributors_count:  d.skipped ? null : (d.distributors_count  ?? null),
        referral_source:     d.skipped ? null : (d.referral_source     ?? null),
        main_pain:           d.skipped ? null : (d.main_pain           ?? null),
        beverage_types:      d.skipped ? []   : d.beverage_types,
        skipped:             d.skipped,
        completed_at:        d.skipped ? null : now,
      },
      update: {
        orders_per_month:    d.skipped ? null : (d.orders_per_month    ?? null),
        monthly_spend_range: d.skipped ? null : (d.monthly_spend_range ?? null),
        distributors_count:  d.skipped ? null : (d.distributors_count  ?? null),
        referral_source:     d.skipped ? null : (d.referral_source     ?? null),
        main_pain:           d.skipped ? null : (d.main_pain           ?? null),
        beverage_types:      d.skipped ? []   : d.beverage_types,
        skipped:             d.skipped,
        completed_at:        d.skipped ? null : now,
      },
    });

    return Response.json({ ok: true, id: survey.id });
  },
  { roles: ["client"] }
);
