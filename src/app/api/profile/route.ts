import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/profile ─────────────────────────────────────────────────────────

export const GET = withAuth(async (_req: NextRequest, user) => {
  if (user.role === "client") {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        company_name: true,
        cnpj: true,
        establishment_type: true,
        responsible_name: true,
        whatsapp: true,
        delivery_city: true,
        delivery_state: true,
        delivery_address_full: true,
        delivery_zip_code: true,
        max_delivery_days_default: true,
        pref_email_monthly_report: true,
        pref_email_price_alerts:   true,
        client_plan: true,
        last_used_address_id: true,
        delivery_addresses: {
          orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
        },
      },
    });

    if (!client) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    return Response.json({ role: "client", profile: client });
  }

  if (user.role === "distributor_admin" || user.role === "distributor_collaborator") {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        company_name: true,
        cnpj: true,
        responsible_name: true,
        whatsapp_commercial: true,
        email_commercial: true,
        plan: true,
        plan_status: true,
        approved_by_admin: true,
      },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    return Response.json({ role: "distributor", profile: distributor });
  }

  return Response.json({ error: "Role não suportado" }, { status: 400 });
});

// ─── PATCH /api/profile ───────────────────────────────────────────────────────

const clientPatchSchema = z.object({
  // company_name e cnpj não são editáveis — validados na Receita Federal no cadastro
  establishment_type: z
    .enum(["bar", "restaurant", "adega", "hotel", "nightclub", "supermarket", "convenience", "other"])
    .optional(),
  responsible_name: z.string().min(2).trim().optional(),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(11).regex(/^\d+$/))
    .optional(),
  delivery_city: z.string().min(2).trim().optional(),
  delivery_state: z.string().length(2).toUpperCase().optional(),
  delivery_address_full: z.string().min(5).trim().optional(),
  delivery_zip_code: z.string().regex(/^\d{8}$/).nullable().optional(),
  max_delivery_days_default:    z.number().int().min(1).max(90).nullable().optional(),
  pref_email_monthly_report:    z.boolean().optional(),
  pref_email_price_alerts:      z.boolean().optional(),
});

const distributorPatchSchema = z.object({
  company_name: z.string().min(2).trim().optional(),
  responsible_name: z.string().min(2).trim().optional(),
  whatsapp_commercial: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(11).regex(/^\d+$/))
    .optional(),
  email_commercial: z.string().email().toLowerCase().trim().optional(),
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  if (user.role === "client") {
    const parsed = clientPatchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updated = await prisma.client.update({
      where: { user_id: user.userId },
      data: parsed.data,
      select: {
        establishment_type: true,
        responsible_name: true,
        whatsapp: true,
        delivery_city: true,
        delivery_state: true,
        delivery_address_full: true,
        delivery_zip_code: true,
        max_delivery_days_default: true,
        pref_email_monthly_report: true,
        pref_email_price_alerts:   true,
      },
    });

    return Response.json({ ok: true, profile: updated });
  }

  if (user.role === "distributor_admin") {
    const parsed = distributorPatchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updated = await prisma.distributor.update({
      where: { user_id: user.userId },
      data: parsed.data,
      select: {
        company_name: true,
        responsible_name: true,
        whatsapp_commercial: true,
        email_commercial: true,
      },
    });

    return Response.json({ ok: true, profile: updated });
  }

  return Response.json({ error: "Sem permissão para editar este perfil" }, { status: 403 });
});
