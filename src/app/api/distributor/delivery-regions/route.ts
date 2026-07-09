import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { deliveryRegionSchema, deliveryRegionsBulkSchema } from "@/types/distributor";
import { normalizeCityName } from "@/lib/coverage";

// ─── GET /api/distributor/delivery-regions ────────────────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil da distribuidora não encontrado" }, { status: 404 });
    }

    const regions = await prisma.deliveryRegion.findMany({
      where: { distributor_id: distributor.id },
      orderBy: [{ state: "asc" }, { city: "asc" }],
    });

    return Response.json({ regions });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

// ─── POST /api/distributor/delivery-regions ───────────────────────────────────
// Aceita objeto único ou array { regions: [...] }

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!distributor) {
      return Response.json(
        { error: "Complete o cadastro do perfil antes de adicionar regiões" },
        { status: 404 }
      );
    }

    // Suporta tanto bulk { regions: [...] } quanto objeto único
    const isBulk = body !== null && typeof body === "object" && "regions" in (body as object);

    if (isBulk) {
      const parsed = deliveryRegionsBulkSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: "Dados inválidos", details: parsed.error.flatten() },
          { status: 422 }
        );
      }

      // Upsert: atualiza se cidade+estado já existir, cria se não existir
      const results = await Promise.all(
        parsed.data.regions.map((region) =>
          prisma.deliveryRegion.upsert({
            where: {
              distributor_id_city_state: {
                distributor_id: distributor.id,
                city: normalizeCityName(region.city),
                state: region.state.toUpperCase(),
              },
            },
            update: {
              delivery_days_business: region.delivery_days_business,
              route_days: region.route_days,
              cutoff_time: region.cutoff_time,
              minimum_order_cents: region.minimum_order_cents,
              freight_type: region.freight_type,
              freight_value_cents: region.freight_value_cents ?? null,
              free_freight_above_cents: region.free_freight_above_cents ?? null,
              freight_notes: region.freight_notes ?? null,
            },
            create: {
              distributor_id: distributor.id,
              city: normalizeCityName(region.city),
              state: region.state.toUpperCase(),
              delivery_days_business: region.delivery_days_business,
              route_days: region.route_days,
              cutoff_time: region.cutoff_time,
              minimum_order_cents: region.minimum_order_cents,
              freight_type: region.freight_type,
              freight_value_cents: region.freight_value_cents ?? null,
              free_freight_above_cents: region.free_freight_above_cents ?? null,
              freight_notes: region.freight_notes ?? null,
            },
          })
        )
      );

      return Response.json(
        { regions: results, message: `${results.length} região(ões) salva(s)` },
        { status: 201 }
      );
    }

    // Objeto único
    const parsed = deliveryRegionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const region = parsed.data;

    const result = await prisma.deliveryRegion.upsert({
      where: {
        distributor_id_city_state: {
          distributor_id: distributor.id,
          city: normalizeCityName(region.city),
          state: region.state.toUpperCase(),
        },
      },
      update: {
        delivery_days_business: region.delivery_days_business,
        route_days: region.route_days,
        cutoff_time: region.cutoff_time,
        minimum_order_cents: region.minimum_order_cents,
        freight_type: region.freight_type,
        freight_value_cents: region.freight_value_cents ?? null,
        free_freight_above_cents: region.free_freight_above_cents ?? null,
        freight_notes: region.freight_notes ?? null,
      },
      create: {
        distributor_id: distributor.id,
        city: normalizeCityName(region.city),
        state: region.state.toUpperCase(),
        delivery_days_business: region.delivery_days_business,
        route_days: region.route_days,
        cutoff_time: region.cutoff_time,
        minimum_order_cents: region.minimum_order_cents,
        freight_type: region.freight_type,
        freight_value_cents: region.freight_value_cents ?? null,
        free_freight_above_cents: region.free_freight_above_cents ?? null,
        freight_notes: region.freight_notes ?? null,
      },
    });

    return Response.json({ region: result }, { status: 201 });
  },
  { roles: ["distributor_admin"] }
);
