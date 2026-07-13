import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { normalizeCityName } from "@/lib/coverage";

const PRODUCT_SELECT = {
  id: true,
  name: true,
  brand: true,
  category: true,
  packaging_type: true,
  packaging_volume_ml: true,
  price_cents: true,
  image_url: true,
} as const;

// GET — clients: ofertas na região deles; distribuidoras: próprias ofertas
export const GET = withAuth(async (req: NextRequest, user) => {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (user.role === "client") {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { delivery_city: true, delivery_state: true },
    });
    if (!client) return Response.json({ offers: [] });

    const allStateRegions = await prisma.deliveryRegion.findMany({
      where: {
        state: { equals: client.delivery_state, mode: "insensitive" },
      },
      select: { distributor_id: true, city: true },
    });
    const targetCityClean = normalizeCityName(client.delivery_city).toLowerCase();
    const regions = allStateRegions.filter(
      (r) => normalizeCityName(r.city).toLowerCase() === targetCityClean
    );
    const distributorIds = [...new Set(regions.map((r) => r.distributor_id))];

    const offers = await prisma.nearExpiryOffer.findMany({
      where: {
        active: true,
        expires_at: { gt: now, lt: in30Days },
        distributor_id: { in: distributorIds },
      },
      include: {
        product: { select: PRODUCT_SELECT },
        distributor: { select: { id: true, company_name: true } },
      },
      orderBy: { expires_at: "asc" },
    });
    return Response.json({ offers });
  }

  if (user.role === "distributor_admin" || user.role === "distributor_collaborator") {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ offers: [] });

    const offers = await prisma.nearExpiryOffer.findMany({
      where: { distributor_id: distributor.id },
      include: { product: { select: PRODUCT_SELECT } },
      orderBy: [{ active: "desc" }, { expires_at: "asc" }],
    });
    return Response.json({ offers });
  }

  return Response.json({ offers: [] });
});

// POST — distribuidora cria oferta
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const body = (await req.json()) as {
      product_id: string;
      expires_at: string;
      discount_pct: number;
      stock: number;
    };

    if (
      !Number.isInteger(body.discount_pct) ||
      body.discount_pct < 0 ||
      body.discount_pct > 99
    ) {
      return Response.json(
        { error: "discount_pct deve ser inteiro entre 0 e 99" },
        { status: 400 }
      );
    }
    if (!body.stock || body.stock < 1) {
      return Response.json({ error: "Estoque deve ser pelo menos 1" }, { status: 400 });
    }
    if (!body.expires_at || isNaN(Date.parse(body.expires_at))) {
      return Response.json({ error: "Data de vencimento inválida" }, { status: 400 });
    }
    if (new Date(body.expires_at) <= new Date()) {
      return Response.json({ error: "Data de vencimento deve ser futura" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id: body.product_id, distributor_id: distributor.id },
    });
    if (!product) {
      return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const offer = await prisma.nearExpiryOffer.create({
      data: {
        distributor_id: distributor.id,
        product_id: body.product_id,
        expires_at: new Date(body.expires_at),
        discount_pct: body.discount_pct,
        stock: body.stock,
      },
      include: { product: { select: PRODUCT_SELECT } },
    });

    return Response.json({ offer }, { status: 201 });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

// DELETE — soft delete (active: false)
export const DELETE = withAuth(
  async (req: NextRequest, user) => {
    const { id } = (await req.json()) as { id: string };

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });
    }

    const offer = await prisma.nearExpiryOffer.findFirst({
      where: { id, distributor_id: distributor.id },
    });
    if (!offer) {
      return Response.json({ error: "Oferta não encontrada" }, { status: 404 });
    }

    await prisma.nearExpiryOffer.update({
      where: { id },
      data: { active: false },
    });

    return Response.json({ ok: true });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
