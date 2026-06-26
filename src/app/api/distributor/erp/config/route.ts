import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function generateApiKey(): string {
  return "hubby_erpkey_" + crypto.randomBytes(24).toString("hex");
}

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        plan: true,
        webhook_url: true,
        webhook_secret: true,
        webhook_enabled: true,
        erp_api_key: true,
      },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    return Response.json({
      plan: distributor.plan,
      is_enterprise: distributor.plan === "enterprise",
      webhook_url: distributor.webhook_url,
      webhook_secret_hint: distributor.webhook_secret
        ? "••••" + distributor.webhook_secret.slice(-4)
        : null,
      webhook_enabled: distributor.webhook_enabled,
      has_api_key: !!distributor.erp_api_key,
    });
  },
  { roles: ["distributor_admin"] }
);

const patchSchema = z.object({
  webhook_url: z.string().url("URL inválida").nullable().optional(),
  webhook_secret: z.string().min(8, "Secret deve ter ao menos 8 caracteres").nullable().optional(),
  webhook_enabled: z.boolean().optional(),
});

export const PATCH = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true },
    });

    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    if (distributor.plan !== "enterprise") {
      return Response.json({ error: "Integração ERP disponível apenas no plano Enterprise" }, { status: 403 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.webhook_url !== undefined) updateData.webhook_url = parsed.data.webhook_url;
    if (parsed.data.webhook_secret !== undefined) updateData.webhook_secret = parsed.data.webhook_secret;
    if (parsed.data.webhook_enabled !== undefined) updateData.webhook_enabled = parsed.data.webhook_enabled;

    const updated = await prisma.distributor.update({
      where: { id: distributor.id },
      data: updateData,
      select: { webhook_url: true, webhook_enabled: true },
    });

    return Response.json({ ok: true, ...updated });
  },
  { roles: ["distributor_admin"] }
);

// POST — gera nova API key
export const POST = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true },
    });

    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    if (distributor.plan !== "enterprise") {
      return Response.json({ error: "Plano Enterprise necessário" }, { status: 403 });
    }

    const erp_api_key = generateApiKey();
    await prisma.distributor.update({
      where: { id: distributor.id },
      data: { erp_api_key },
    });

    return Response.json({ ok: true, erp_api_key });
  },
  { roles: ["distributor_admin"] }
);
