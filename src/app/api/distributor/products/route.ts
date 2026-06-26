import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";
import { ProductCategory, PackagingType } from "@prisma/client";

// ─── GET /api/distributor/products ───────────────────────────────────────────

export const GET = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") as ProductCategory | null;
    const available = searchParams.get("available");
    const search = searchParams.get("q");

    const products = await prisma.product.findMany({
      where: {
        distributor_id: distributor.id,
        ...(category ? { category } : {}),
        ...(available !== null ? { available: available === "true" } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: "asc" }, { brand: "asc" }, { name: "asc" }],
    });

    return Response.json({ products, count: products.length });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

// ─── POST /api/distributor/products ──────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.nativeEnum(ProductCategory),
  brand: z.string().min(1).max(100),
  packaging_type: z.nativeEnum(PackagingType),
  packaging_volume_ml: z.number().int().min(1),
  price_cents: z.number().int().positive("Preço deve ser maior que zero"),
  available: z.boolean().default(true),
});

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = createProductSchema.safeParse(body);
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

    // Tenta associar imagem do catálogo central pela primeiras palavras do nome + marca + volume
    const nameTokens = parsed.data.name.split(" ").slice(0, 3).join(" ");
    const catalogMatch = await prisma.productCatalog.findFirst({
      where: {
        brand: { equals: parsed.data.brand, mode: "insensitive" },
        name:  { contains: nameTokens, mode: "insensitive" },
        packaging_volume_ml: parsed.data.packaging_volume_ml,
      },
      select: { image_url: true },
    });

    const product = await prisma.product.create({
      data: {
        distributor_id: distributor.id,
        ...parsed.data,
        price_updated_at: new Date(),
        image_url:    catalogMatch?.image_url ?? null,
        image_source: catalogMatch ? "hubby_catalog" : "none",
      },
    });

    await markDistributorProductsUpdated(distributor.id);

    return Response.json({ product }, { status: 201 });
  },
  { roles: ["distributor_admin"] }
);
