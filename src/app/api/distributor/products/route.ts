import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";
import { ProductCategory, PackagingType } from "@prisma/client";
import { processProductMatchingPipeline } from "@/lib/matching-engine";

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

    // Executa o pipeline de matching inteligente
    const matchResult = await processProductMatchingPipeline({
      rawName: parsed.data.name,
      brand: parsed.data.brand,
      packageType: parsed.data.packaging_type as PackagingType,
      unitVolumeMl: parsed.data.packaging_volume_ml,
      distributorId: distributor.id,
    });

    const primaryImageUrl = matchResult.isMatched
      ? matchResult.masterProduct.images?.find((i) => i.is_primary)?.url ?? matchResult.masterProduct.images?.[0]?.url ?? null
      : null;

    const product = await prisma.product.create({
      data: {
        distributor_id: distributor.id,
        ...parsed.data,
        price_updated_at: new Date(),
        master_product_id: matchResult.isMatched ? matchResult.masterProduct.id : null,
        image_url: primaryImageUrl,
        image_source: matchResult.isMatched && primaryImageUrl ? "hubby_catalog" : "none",
      },
    });

    await markDistributorProductsUpdated(distributor.id);

    return Response.json({ product }, { status: 201 });
  },
  { roles: ["distributor_admin"] }
);
