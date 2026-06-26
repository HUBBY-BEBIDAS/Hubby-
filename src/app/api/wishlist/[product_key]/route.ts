import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const addSchema = z.object({
  product_name:        z.string().min(1).max(200),
  brand:               z.string().min(1).max(100),
  category:            z.string().min(1),
  packaging_type:      z.string().min(1),
  packaging_volume_ml: z.number().int().positive(),
  image_url:           z.string().url().nullable().optional(),
});

/** POST /api/wishlist/:product_key — adiciona produto à lista de desejos. */
export const POST = withAuth(
  async (req: NextRequest, user, context) => {
    const productKey = decodeURIComponent(context?.params.product_key ?? "");
    if (!productKey) return Response.json({ error: "product_key inválido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId }, select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const item = await prisma.wishlistItem.upsert({
      where:  { client_id_product_key: { client_id: client.id, product_key: productKey } },
      create: {
        client_id:          client.id,
        product_key:        productKey,
        product_name:       parsed.data.product_name,
        brand:              parsed.data.brand,
        category:           parsed.data.category,
        packaging_type:     parsed.data.packaging_type,
        packaging_volume_ml: parsed.data.packaging_volume_ml,
        image_url:          parsed.data.image_url ?? null,
      },
      update: {}, // já existe — sem-op
    });

    return Response.json({ item }, { status: 201 });
  },
  { roles: ["client"] }
);

/** DELETE /api/wishlist/:product_key — remove produto da lista de desejos. */
export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const productKey = decodeURIComponent(context?.params.product_key ?? "");
    if (!productKey) return Response.json({ error: "product_key inválido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId }, select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    await prisma.wishlistItem.deleteMany({
      where: { client_id: client.id, product_key: productKey },
    });

    return Response.json({ ok: true });
  },
  { roles: ["client"] }
);
