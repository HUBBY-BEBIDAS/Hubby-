import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";
import { hasDistributorFeature } from "@/config/plans";
import type { ProductCategory, PackagingType } from "@prisma/client";

const productSchema = z.object({
  name:                z.string().min(1),
  category:            z.string().min(1),
  brand:               z.string().min(1),
  packaging_type:      z.string().min(1),
  packaging_volume_ml: z.number().int().min(0),
  price_cents:         z.number().int().min(0),
  available:           z.boolean(),
});

const bodySchema = z.object({
  products: z.array(productSchema).min(1, "Pelo menos 1 produto é necessário"),
  /**
   * Motivo da alteração — registrado no log para rastreabilidade.
   * Ex: "Onboarding assistido Pro — carga inicial do catálogo"
   */
  reason: z.string().min(3).max(500).default("Importação pelo admin Bébbi"),
});

function productKey(p: {
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
}): string {
  return [
    p.name.toLowerCase().trim(),
    p.brand.toLowerCase().trim(),
    p.category,
    p.packaging_type,
    p.packaging_volume_ml,
  ].join("|");
}

const BATCH_SIZE = 100;

/**
 * POST /api/admin/distributors/[id]/catalog-import
 *
 * Permite que o Admin Bébbi importe ou edite o catálogo em nome de uma
 * distribuidora do plano Pro (onboarding assistido).
 *
 * - Só funciona para distribuidoras com flag canImportBulkCatalog = true (Pro/Enterprise).
 * - Registra log com o motivo e quem executou a ação.
 * - Requer role platform_admin.
 */
export const POST = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Verifica se a distribuidora existe e qual o plano
    const distributor = await prisma.distributor.findUnique({
      where:  { id },
      select: { id: true, company_name: true, plan: true },
    });

    if (!distributor) {
      return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });
    }

    // Garante que o plano suporta importação em massa (Pro ou Enterprise)
    if (!hasDistributorFeature(distributor.plan, "canImportBulkCatalog")) {
      return Response.json(
        {
          error:
            `A distribuidora "${distributor.company_name}" está no plano ${distributor.plan.toUpperCase()} ` +
            `e não possui o recurso de importação em massa. Disponível a partir do plano Pro.`,
          feature: "canImportBulkCatalog",
        },
        { status: 403 }
      );
    }

    const { products, reason } = parsed.data;

    // Busca produtos existentes para upsert inteligente
    const existingProducts = await prisma.product.findMany({
      where:  { distributor_id: id },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        packaging_type: true,
        packaging_volume_ml: true,
      },
    });

    const existingMap = new Map<string, string>(
      existingProducts.map((p) => [productKey(p), p.id])
    );

    let created = 0;
    let updated = 0;
    let failed  = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (row) => {
          const key        = productKey(row);
          const existingId = existingMap.get(key);
          try {
            if (existingId) {
              await prisma.product.update({
                where: { id: existingId },
                data:  {
                  price_cents:       row.price_cents,
                  available:         row.available,
                  price_updated_at:  new Date(),
                },
              });
              updated++;
            } else {
              const created_product = await prisma.product.create({
                data: {
                  distributor_id:      id,
                  name:                row.name,
                  category:            row.category as ProductCategory,
                  brand:               row.brand,
                  packaging_type:      row.packaging_type as PackagingType,
                  packaging_volume_ml: row.packaging_volume_ml,
                  price_cents:         row.price_cents,
                  available:           row.available,
                  price_updated_at:    new Date(),
                },
              });
              existingMap.set(key, created_product.id);
              created++;
            }
          } catch (err) {
            console.error(`[admin/catalog-import] Erro no upsert do produto: ${row.name}`, err);
            failed++;
          }
        })
      );
    }

    // Invalida o cache de ranking para que os novos preços entrem em vigor imediatamente
    await markDistributorProductsUpdated(id).catch(() => {});

    console.log(
      `[admin/catalog-import] Admin ${user.userId} importou catálogo em nome de ` +
      `"${distributor.company_name}" (${id}). ` +
      `Criados: ${created} | Atualizados: ${updated} | Erros: ${failed} | Motivo: "${reason}"`
    );

    return Response.json({
      ok:        true,
      imported:  created + updated,
      created,
      updated,
      failed,
      reason,
      performed_by: user.userId,
      message:
        `Importação concluída em nome de "${distributor.company_name}". ` +
        `Criados: ${created}, Atualizados: ${updated}, Erros: ${failed}`,
    });
  },
  { roles: ["platform_admin"] }
);
