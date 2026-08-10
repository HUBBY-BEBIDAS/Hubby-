import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { validateCnpjReceita, cleanCnpj } from "@/lib/cnpj";
import { deleteLogo } from "@/lib/storage";
import { distributorProfileSchema, FREIGHT_TYPES } from "@/types/distributor";
import { geocodeCepOrAddress } from "@/lib/geocoding";

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

    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;

    if (input.address) {
      const coords = await geocodeCepOrAddress({
        cep: input.address.zipcode,
        addressFull: `${input.address.street}, ${input.address.number} - ${input.address.district}`,
        city: input.address.city,
        state: input.address.state,
      });
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
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
      ...(lat !== undefined ? { lat, lng } : {}),
      delivery_mode: input.delivery_mode,
      max_delivery_radius_km: input.max_delivery_radius_km,
      radius_delivery_days_business: input.radius_delivery_days_business,
      radius_cutoff_time: input.radius_cutoff_time,
      radius_route_days: input.radius_route_days,
      radius_minimum_order_cents: input.radius_minimum_order_cents,
      radius_freight_type: input.radius_freight_type,
      radius_freight_value_cents: input.radius_freight_value_cents,
      radius_free_freight_above_cents: input.radius_free_freight_above_cents,
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
  whatsapp_commercial: z.string().optional(),
  email_commercial: z.string().optional(),
  responsible_name: z.string().optional(),
  logo_key: z.string().nullable().optional(),
  logo_base64: z.string().optional(),
  payment_methods: z.array(z.string()).optional(),
  payment_terms_days: z.array(z.number().int()).optional(),
  use_platform_credit_default: z.boolean().optional(),
  credit_score_minimum: z.number().int().optional(),
  credit_accepts_restrictions: z.boolean().optional(),
  credit_min_cnpj_months: z.number().int().optional(),
  business_hours: z.record(z.string(), z.string().nullable()).optional(),
  accepts_orders_outside_hours: z.boolean().optional(),
  address: z.any().optional(),
  delivery_mode: z.enum(["region", "radius"]).optional(),
  max_delivery_radius_km: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    }, z.number().min(1).max(500).nullable())
    .optional(),
  radius_delivery_days_business: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === "") return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    }, z.number().min(1).max(30))
    .optional(),
  radius_cutoff_time: z.string().optional(),
  radius_route_days: z.array(z.string()).optional(),
  radius_minimum_order_cents: z.number().int().min(0).optional(),
  radius_freight_type: z.enum(FREIGHT_TYPES).optional(),
  radius_freight_value_cents: z.number().int().min(0).optional().nullable(),
  radius_free_freight_above_cents: z.number().int().min(0).optional().nullable(),
});

export const PATCH = withAuth(
  async (req: NextRequest, user) => {
    try {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Body inválido" }, { status: 400 });
      }

      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) {
        console.error("[PATCH /api/distributor/profile] Validation error:", JSON.stringify(parsed.error.flatten().fieldErrors));
        return Response.json(
          { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
          { status: 422 }
        );
      }

      let distributor = await prisma.distributor.findUnique({
        where: { user_id: user.userId },
        select: { id: true },
      });

      if (!distributor && user.email) {
        distributor = await prisma.distributor.findFirst({
          where: { email_commercial: user.email },
          select: { id: true },
        });
      }

      if (!distributor) {
        distributor = await prisma.distributor.create({
          data: {
            user_id: user.userId,
            company_name: "Distribuidora",
            cnpj: String(Date.now()).padStart(14, "0").slice(-14),
            whatsapp_commercial: "11999999999",
            email_commercial: user.email ?? "comercial@distribuidora.com",
          },
          select: { id: true },
        });
      }

      const {
        use_platform_credit_default,
        credit_score_minimum,
        logo_base64,
        business_hours,
        accepts_orders_outside_hours,
        address,
        whatsapp_commercial,
        email_commercial,
        responsible_name,
        ...rest
      } = parsed.data;

      const updateData: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(rest)) {
        if (val !== undefined) {
          updateData[key] = val;
        }
      }

      // Trunca o horário de corte para no máximo 5 caracteres ("16:00") atendendo a restrição @db.VarChar(5)
      if (typeof updateData.radius_cutoff_time === "string") {
        updateData.radius_cutoff_time = updateData.radius_cutoff_time.trim().slice(0, 5) || "16:00";
      }

      if (typeof whatsapp_commercial === "string") {
        const cleanPhone = whatsapp_commercial.replace(/\D/g, "");
        if (cleanPhone.length >= 8) {
          updateData.whatsapp_commercial = cleanPhone;
        }
      }
      if (email_commercial && email_commercial.includes("@")) {
        updateData.email_commercial = email_commercial;
      }
      if (responsible_name && responsible_name.trim().length >= 2) {
        updateData.responsible_name = responsible_name;
      }

      if (address !== undefined) {
        updateData.address = address;
        if (address && address.zipcode && address.city && address.state) {
          try {
            const coords = await geocodeCepOrAddress({
              cep: String(address.zipcode).replace(/\D/g, ""),
              addressFull: `${address.street ?? ""}, ${address.number ?? ""} - ${address.district ?? ""}`,
              city: address.city,
              state: String(address.state).toUpperCase(),
            });
            if (coords) {
              updateData.lat = coords.lat;
              updateData.lng = coords.lng;
            }
          } catch (e) {
            console.error("[PATCH /api/distributor/profile] Geocoding exception ignored:", e);
          }
        }
      }

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
    } catch (err: any) {
      console.error("[PATCH /api/distributor/profile] Server Exception:", err);
      return Response.json({ error: err?.message ?? "Erro interno ao atualizar perfil" }, { status: 500 });
    }
  },
  { roles: ["distributor_admin"] }
);
