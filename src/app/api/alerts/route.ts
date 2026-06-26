import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import type { ProductCategory } from "@prisma/client";

/**
 * GET /api/alerts
 * Lista todos os alertas de preço do comprador autenticado.
 *
 * POST /api/alerts
 * Cria ou atualiza um alerta de preço para uma combinação brand+categoria.
 * Retorna 409 se já existe (use PUT para atualizar).
 * Plano Pro: sem limite. Plano Free: máximo 3 alertas.
 */

const createSchema = z.object({
  brand: z.string().min(1).max(100).trim(),
  category: z.string().min(1).max(50),
});

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const alerts = await prisma.priceAlert.findMany({
      where: { client_id: client.id },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        brand: true,
        category: true,
        last_seen_price_cents: true,
        created_at: true,
      },
    });

    return Response.json({ alerts });
  },
  { roles: ["client"] }
);

export const POST = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true, client_plan: true, client_plan_status: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    // Plano Free: máximo 3 alertas
    const isPro = client.client_plan === "pro" && client.client_plan_status === "active";
    if (!isPro) {
      const count = await prisma.priceAlert.count({ where: { client_id: client.id } });
      if (count >= 3) {
        return Response.json(
          { error: "Plano gratuito permite no máximo 3 alertas. Faça upgrade para o plano Pro.", upgrade_required: true },
          { status: 403 }
        );
      }
    }

    // Upsert — idempotente
    const alert = await prisma.priceAlert.upsert({
      where: {
        client_id_brand_category: {
          client_id: client.id,
          brand: parsed.data.brand,
          category: parsed.data.category,
        },
      },
      update: {},
      create: {
        client_id: client.id,
        brand: parsed.data.brand,
        category: parsed.data.category as ProductCategory,
      },
      select: { id: true, brand: true, category: true, created_at: true },
    });

    return Response.json({ alert }, { status: 201 });
  },
  { roles: ["client"] }
);
