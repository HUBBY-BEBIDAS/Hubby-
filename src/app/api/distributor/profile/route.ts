import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { validateCnpjReceita, cleanCnpj } from "@/lib/cnpj";
import { deleteLogo } from "@/lib/storage";
import { distributorProfileSchema } from "@/types/distributor";

// ─── GET /api/distributor/profile ─────────────────────────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      include: { delivery_regions: { orderBy: [{ state: "asc" }, { city: "asc" }] } },
    });

    if (!distributor) {
      return Response.json({ profile: null });
    }

    const [activeCount, inactiveCount, lastProduct] = await Promise.all([
      prisma.product.count({ where: { distributor_id: distributor.id, available: true } }),
      prisma.product.count({ where: { distributor_id: distributor.id, available: false } }),
      prisma.product.findFirst({
        where: { distributor_id: distributor.id },
        orderBy: { price_updated_at: "desc" },
        select: { price_updated_at: true },
      }),
    ]);

    return Response.json({
      profile: distributor,
      products_summary: {
        active: activeCount,
        inactive: inactiveCount,
        last_updated_at: lastProduct?.price_updated_at ?? null,
      },
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

// ─── POST /api/distributor/profile ────────────────────────────────────────────

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = distributorProfileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const cnpj = cleanCnpj(input.cnpj);

    // Verifica se o CNPJ já pertence a outra distribuidora
    const existing = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, cnpj: true, logo_key: true },
    });

    const cnpjBelongsToAnother = await prisma.distributor.findFirst({
      where: {
        cnpj,
        user_id: { not: user.userId },
      },
      select: { id: true },
    });

    if (cnpjBelongsToAnother) {
      return Response.json(
        { error: "Este CNPJ já está cadastrado na plataforma" },
        { status: 409 }
      );
    }

    // Valida CNPJ na Receita Federal
    // Se o CNPJ não mudou (atualização), reavalida mesmo assim para garantir que continua ativo
    const cnpjResult = await validateCnpjReceita(cnpj);
    if (!cnpjResult.valid) {
      return Response.json(
        { error: cnpjResult.message, reason: cnpjResult.reason },
        { status: 422 }
      );
    }

    // Usa a razão social da Receita para evitar cadastro com nome falso
    const razaoSocialReceita = cnpjResult.data.razao_social;

    // Resolve o credit_score_minimum
    const credit_score_minimum =
      input.use_platform_credit_default
        ? 500
        : (input.credit_score_minimum ?? 500);

    // Substitui logo antiga se houver nova key (ignora data URLs — não estão no bucket)
    if (
      existing?.logo_key &&
      input.logo_key &&
      existing.logo_key !== input.logo_key &&
      !existing.logo_key.startsWith("data:")
    ) {
      try {
        await deleteLogo(existing.logo_key);
      } catch {
        // Não bloqueia o cadastro se a deleção falhar — log seria capturado pelo Sentry
        console.error("[profile] Falha ao deletar logo antiga:", existing.logo_key);
      }
    }

    const data = {
      company_name: razaoSocialReceita, // sempre usa o nome da Receita
      cnpj,
      responsible_name: input.responsible_name,
      whatsapp_commercial: input.whatsapp_commercial,
      email_commercial: input.email_commercial,
      logo_key: input.logo_key ?? existing?.logo_key ?? null,
      address: (input.address ?? null) as Prisma.InputJsonValue | typeof Prisma.DbNull,
      payment_methods: input.payment_methods,
      payment_terms_days: input.payment_terms_days,
      cnpj_status: cnpjResult.data.situacao_cadastral,
      cnpj_verified_at: new Date(),
      credit_score_minimum,
      credit_accepts_restrictions: input.credit_accepts_restrictions,
      credit_min_cnpj_months: input.credit_min_cnpj_months,
      // approved_by_admin permanece false — o admin aprova separadamente
    };

    let distributor;
    if (existing) {
      distributor = await prisma.distributor.update({
        where: { id: existing.id },
        data,
        include: { delivery_regions: true },
      });
    } else {
      distributor = await prisma.distributor.create({
        data: {
          ...data,
          user_id: user.userId,
          approved_by_admin: false,
        },
        include: { delivery_regions: true },
      });
    }

    return Response.json(
      {
        profile: distributor,
        message: existing
          ? "Perfil atualizado. Aguardando aprovação do administrador."
          : "Cadastro recebido. Aguardando aprovação do administrador.",
        approved: false,
      },
      { status: existing ? 200 : 201 }
    );
  },
  { roles: ["distributor_admin"] }
);

// ─── PATCH /api/distributor/profile ───────────────────────────────────────────
// Atualiza campos editáveis sem re-validar CNPJ na Receita Federal

const patchSchema = z.object({
  whatsapp_commercial: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(11))
    .optional(),
  email_commercial: z.string().email().toLowerCase().trim().optional(),
  responsible_name: z.string().min(2).trim().optional(),
  logo_key: z.string().nullable().optional(),
  // Fallback de desenvolvimento: data URL enviada diretamente (sem S3)
  logo_base64: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|webp|svg\+xml);base64,/,
      "Formato inválido — envie uma imagem PNG, JPG, WebP ou SVG"
    )
    .max(3 * 1024 * 1024, "Imagem muito grande — máximo 2 MB")
    .optional(),
  payment_methods: z
    .array(z.string())
    .min(1, "Selecione ao menos uma forma de pagamento")
    .optional(),
  payment_terms_days: z.array(z.number().int().min(0).max(90)).optional(),
  use_platform_credit_default: z.boolean().optional(),
  credit_score_minimum: z.number().int().min(0).max(1000).optional(),
  credit_accepts_restrictions: z.boolean().optional(),
  credit_min_cnpj_months: z.number().int().min(0).max(120).optional(),
  business_hours: z.record(z.string(), z.string().nullable()).optional(),
  accepts_orders_outside_hours: z.boolean().optional(),
});

export const PATCH = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const { use_platform_credit_default, credit_score_minimum, logo_base64, business_hours, accepts_orders_outside_hours, ...rest } = parsed.data;

    const updateData: Record<string, unknown> = { ...rest };

    if (logo_base64) {
      updateData.logo_key = logo_base64;
    }
    if (business_hours !== undefined) {
      updateData.business_hours = business_hours;
    }
    if (accepts_orders_outside_hours !== undefined) {
      updateData.accepts_orders_outside_hours = accepts_orders_outside_hours;
    }
    if (use_platform_credit_default === true) {
      updateData.credit_score_minimum = 500;
      updateData.credit_accepts_restrictions = false;
      updateData.credit_min_cnpj_months = 6;
    } else if (use_platform_credit_default === false && credit_score_minimum !== undefined) {
      updateData.credit_score_minimum = credit_score_minimum;
    }

    const updated = await prisma.distributor.update({
      where: { id: distributor.id },
      data: updateData,
    });

    return Response.json({ ok: true, profile: updated });
  },
  { roles: ["distributor_admin"] }
);
