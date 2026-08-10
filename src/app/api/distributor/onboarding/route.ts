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
        delivery_mode: true,
        max_delivery_radius_km: true,
        radius_delivery_days_business: true,
        radius_cutoff_time: true,
        radius_route_days: true,
        radius_minimum_order_cents: true,
        radius_freight_type: true,
        radius_freight_value_cents: true,
        radius_free_freight_above_cents: true,
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

    const hasRegions =
      distributor._count.delivery_regions > 0 ||
      (distributor.delivery_mode === "radius" && distributor.max_delivery_radius_km !== null);

    return Response.json({
      onboarding_completed: distributor.onboarding_completed,
      onboarding_step:      distributor.onboarding_step,
      company_name:         distributor.company_name,
      has_products:         distributor._count.products > 0,
      has_regions:          hasRegions,
      products_count:       distributor._count.products,
      regions_count:        distributor._count.delivery_regions,
      credit_score_minimum: distributor.credit_score_minimum,
      credit_accepts_restrictions: distributor.credit_accepts_restrictions,
      credit_min_cnpj_months: distributor.credit_min_cnpj_months,
      delivery_mode:         distributor.delivery_mode,
      max_delivery_radius_km: distributor.max_delivery_radius_km,
      radius_delivery_days_business: distributor.radius_delivery_days_business,
      radius_cutoff_time:     distributor.radius_cutoff_time,
      radius_route_days:      distributor.radius_route_days,
      radius_minimum_order_cents: distributor.radius_minimum_order_cents,
      radius_freight_type:    distributor.radius_freight_type,
      radius_freight_value_cents: distributor.radius_freight_value_cents,
      radius_free_freight_above_cents: distributor.radius_free_freight_above_cents,
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
  // Configuração de entrega por Raio
  delivery_mode:                 z.enum(["region", "radius"]).optional(),
  max_delivery_radius_km:        z.number().int().min(1).max(500).optional().nullable(),
  radius_delivery_days_business: z.number().int().min(1).max(30).optional(),
  radius_cutoff_time:            z.string().optional(),
  radius_route_days:             z.array(z.string()).optional(),
  radius_minimum_order_cents:    z.number().int().min(0).optional(),
  radius_freight_type:           z.enum(["free", "fixed", "by_weight", "by_value", "custom"]).optional(),
  radius_freight_value_cents:    z.number().int().min(0).optional().nullable(),
  radius_free_freight_above_cents: z.number().int().min(0).optional().nullable(),
});

export const PATCH = withAuth(
  async (req: NextRequest, user) => {
    try {
      let distributor = await prisma.distributor.findUnique({
        where: { user_id: user.userId },
        select: { id: true },
      });
      if (!distributor) {
        distributor = await prisma.distributor.create({
          data: {
            user_id: user.userId,
            company_name: "Distribuidora",
            cnpj: `TEMP_${Date.now()}`,
            whatsapp_commercial: "11999999999",
            email_commercial: user.email ?? "comercial@distribuidora.com",
          },
          select: { id: true },
        });
      }

      let body: unknown;
      try { body = await req.json(); } catch {
        return Response.json({ error: "Body inválido" }, { status: 400 });
      }

      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) {
        console.error("[onboarding PATCH] Erro de validação Zod:", JSON.stringify(parsed.error.flatten().fieldErrors));
        return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
      }

      const data: Record<string, unknown> = {};
      if (parsed.data.step      !== undefined) data.onboarding_step      = parsed.data.step;
      if (parsed.data.completed !== undefined) data.onboarding_completed = parsed.data.completed;
      if (parsed.data.credit_score_minimum        !== undefined) data.credit_score_minimum        = parsed.data.credit_score_minimum;
      if (parsed.data.credit_accepts_restrictions !== undefined) data.credit_accepts_restrictions = parsed.data.credit_accepts_restrictions;
      if (parsed.data.credit_min_cnpj_months      !== undefined) data.credit_min_cnpj_months      = parsed.data.credit_min_cnpj_months;
      if (parsed.data.delivery_mode                 !== undefined) data.delivery_mode                 = parsed.data.delivery_mode;
      if (parsed.data.max_delivery_radius_km        !== undefined) data.max_delivery_radius_km        = parsed.data.max_delivery_radius_km;
      if (parsed.data.radius_delivery_days_business !== undefined) data.radius_delivery_days_business = parsed.data.radius_delivery_days_business;
      if (parsed.data.radius_cutoff_time            !== undefined) data.radius_cutoff_time            = parsed.data.radius_cutoff_time.slice(0, 5);
      if (parsed.data.radius_route_days             !== undefined) data.radius_route_days             = parsed.data.radius_route_days;
      if (parsed.data.radius_minimum_order_cents    !== undefined) data.radius_minimum_order_cents    = parsed.data.radius_minimum_order_cents;
      if (parsed.data.radius_freight_type           !== undefined) data.radius_freight_type           = parsed.data.radius_freight_type;
      if (parsed.data.radius_freight_value_cents    !== undefined) data.radius_freight_value_cents    = parsed.data.radius_freight_value_cents;
      if (parsed.data.radius_free_freight_above_cents !== undefined) data.radius_free_freight_above_cents = parsed.data.radius_free_freight_above_cents;

      await prisma.distributor.update({ where: { id: distributor.id }, data });

      return Response.json({ ok: true });
    } catch (err) {
      console.error("[onboarding PATCH] Erro inesperado ao salvar onboarding:", err);
      return Response.json({ error: "Erro ao salvar configurações. Tente novamente." }, { status: 500 });
    }
  },
  { roles: ["distributor_admin"] }
);
