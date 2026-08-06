import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { learnProductAlias, logMatchingHistory } from "@/lib/matching-engine";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";

const approveSchema = z.object({
  unmatched_import_id: z.string().uuid("ID do item pendente inválido"),
  master_product_id: z.string().uuid("ID do MasterProduct inválido"),
});

/**
 * POST /api/admin/matching/approve
 * Aprovação em 1 clique da correspondência:
 * 1. Vincula o produto da distribuidora ao MasterProduct.
 * 2. Grava um MasterProductAlias com o responsável (admin).
 * 3. Copia a imagem oficial para o produto da distribuidora.
 * 4. Marca o item da fila de curadoria como 'matched'.
 * 5. Registra o histórico de matching em MatchingHistory.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { unmatched_import_id, master_product_id } = parsed.data;

    const unmatchedItem = await prisma.unmatchedImportItem.findUnique({
      where: { id: unmatched_import_id },
    });
    if (!unmatchedItem) {
      return Response.json({ error: "Item de curadoria não encontrado" }, { status: 404 });
    }

    const masterProduct = await prisma.masterProduct.findUnique({
      where: { id: master_product_id },
      include: { images: { where: { is_primary: true }, take: 1 } },
    });
    if (!masterProduct) {
      return Response.json({ error: "MasterProduct não encontrado" }, { status: 404 });
    }

    const primaryImageUrl = masterProduct.images[0]?.url ?? null;

    // 1. Atualiza produtos com esse nome bruto para essa distribuidora
    const updatedProducts = await prisma.product.updateMany({
      where: {
        distributor_id: unmatchedItem.distributor_id,
        name: { equals: unmatchedItem.raw_name, mode: "insensitive" },
      },
      data: {
        master_product_id: masterProduct.id,
        ...(primaryImageUrl
          ? {
              image_url: primaryImageUrl,
              image_source: "hubby_catalog",
            }
          : {}),
      },
    });

    // 2. Aprende o Alias com o criador admin
    await learnProductAlias({
      masterProductId: masterProduct.id,
      rawName: unmatchedItem.raw_name,
      createdBy: user.userId,
    });

    // 3. Registra a auditoria
    await logMatchingHistory({
      distributorId: unmatchedItem.distributor_id,
      rawName: unmatchedItem.raw_name,
      matchedBy: "admin_manual",
      masterProductId: masterProduct.id,
      confidence: 1.0,
      durationMs: 0,
    });

    // 4. Marca como concluído na fila de curadoria
    await prisma.unmatchedImportItem.update({
      where: { id: unmatched_import_id },
      data: { status: "matched" },
    });

    await markDistributorProductsUpdated(unmatchedItem.distributor_id);

    return Response.json({
      success: true,
      message: "Vínculo aprovado e alias registrado com sucesso!",
      updated_products_count: updatedProducts.count,
    });
  },
  { roles: ["platform_admin"] }
);
