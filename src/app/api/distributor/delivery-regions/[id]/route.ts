import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { deliveryRegionSchema } from "@/types/distributor";

type RouteContext = { params: { id: string } };

// ─── PATCH /api/distributor/delivery-regions/[id] ─────────────────────────────

export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const regionId = context?.params.id;
    if (!regionId) {
      return Response.json({ error: "ID da região não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = deliveryRegionSchema.partial().safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Verifica que a região pertence à distribuidora do usuário autenticado
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const region = await prisma.deliveryRegion.findFirst({
      where: { id: regionId, distributor_id: distributor.id },
    });

    if (!region) {
      return Response.json({ error: "Região não encontrada" }, { status: 404 });
    }

    const updated = await prisma.deliveryRegion.update({
      where: { id: regionId },
      data: {
        ...(parsed.data.delivery_days_business !== undefined && {
          delivery_days_business: parsed.data.delivery_days_business,
        }),
        ...(parsed.data.route_days !== undefined && {
          route_days: parsed.data.route_days,
        }),
        ...(parsed.data.cutoff_time !== undefined && {
          cutoff_time: parsed.data.cutoff_time,
        }),
        ...(parsed.data.minimum_order_cents !== undefined && {
          minimum_order_cents: parsed.data.minimum_order_cents,
        }),
        ...(parsed.data.freight_type !== undefined && {
          freight_type: parsed.data.freight_type,
        }),
        ...(parsed.data.freight_value_cents !== undefined && {
          freight_value_cents: parsed.data.freight_value_cents,
        }),
        ...(parsed.data.free_freight_above_cents !== undefined && {
          free_freight_above_cents: parsed.data.free_freight_above_cents,
        }),
        ...(parsed.data.freight_notes !== undefined && {
          freight_notes: parsed.data.freight_notes,
        }),
      },
    });

    return Response.json({ region: updated });
  },
  { roles: ["distributor_admin"] }
);

// ─── DELETE /api/distributor/delivery-regions/[id] ────────────────────────────

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const regionId = context?.params.id;
    if (!regionId) {
      return Response.json({ error: "ID da região não fornecido" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const region = await prisma.deliveryRegion.findFirst({
      where: { id: regionId, distributor_id: distributor.id },
    });

    if (!region) {
      return Response.json({ error: "Região não encontrada" }, { status: 404 });
    }

    await prisma.deliveryRegion.delete({ where: { id: regionId } });

    return Response.json({ message: "Região removida com sucesso" });
  },
  { roles: ["distributor_admin"] }
);
