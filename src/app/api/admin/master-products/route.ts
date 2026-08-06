import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import type { ProductCategory, PackagingType } from "@prisma/client";

const masterProductSchema = z.object({
  ean_code: z.string().optional().nullable(),
  brand: z.string().min(1, "Marca é obrigatória"),
  manufacturer: z.string().optional().nullable(),
  name: z.string().min(1, "Nome é obrigatório"),
  category: z.string(),
  subcategory: z.string().optional().nullable(),
  unit_volume_ml: z.number().int().positive("Volume deve ser positivo"),
  units_per_package: z.number().int().positive().default(1),
  package_type: z.string(),
  alcohol_percentage: z.number().optional().nullable(),
  primary_image_url: z.string().url("URL de imagem inválida").optional().nullable(),
});

/**
 * GET /api/admin/master-products
 * Lista os produtos do catálogo oficial com filtros e paginação.
 */
export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const brand = searchParams.get("brand");
    const category = searchParams.get("category");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

    const where = {
      status: "active" as const,
      ...(category ? { category: category as ProductCategory } : {}),
      ...(brand ? { brand: { equals: brand, mode: "insensitive" as const } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { brand: { contains: q, mode: "insensitive" as const } },
              { ean_code: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, masterProducts] = await Promise.all([
      prisma.masterProduct.count({ where }),
      prisma.masterProduct.findMany({
        where,
        include: {
          images: { orderBy: { is_primary: "desc" } },
          _count: { select: { matched_products: true, aliases: true } },
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return Response.json({
      master_products: masterProducts,
      total,
      page,
      total_pages: Math.ceil(total / limit),
    });
  },
  { roles: ["platform_admin"] }
);

/**
 * POST /api/admin/master-products
 * Cadastra um novo produto no catálogo oficial da Hubby.
 */
export const POST = withAuth(
  async (req: NextRequest) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const parsed = masterProductSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const {
      ean_code,
      brand,
      manufacturer,
      name,
      category,
      subcategory,
      unit_volume_ml,
      units_per_package,
      package_type,
      alcohol_percentage,
      primary_image_url,
    } = parsed.data;

    // Se EAN fornecido, verifica unicidade
    if (ean_code) {
      const existing = await prisma.masterProduct.findUnique({
        where: { ean_code: ean_code.trim() },
      });
      if (existing) {
        return Response.json({ error: "EAN já cadastrado no catálogo oficial" }, { status: 409 });
      }
    }

    const masterProduct = await prisma.masterProduct.create({
      data: {
        ean_code: ean_code?.trim() || null,
        brand: brand.trim(),
        manufacturer: manufacturer?.trim() || null,
        name: name.trim(),
        category: category as ProductCategory,
        subcategory: subcategory?.trim() || null,
        unit_volume_ml,
        units_per_package,
        package_type: package_type as PackagingType,
        alcohol_percentage: alcohol_percentage ?? null,
        status: "active",
        images: primary_image_url
          ? {
              create: {
                url: primary_image_url,
                format: "webp",
                image_type: "frontal",
                is_primary: true,
              },
            }
          : undefined,
      },
      include: { images: true },
    });

    return Response.json({ master_product: masterProduct }, { status: 201 });
  },
  { roles: ["platform_admin"] }
);
