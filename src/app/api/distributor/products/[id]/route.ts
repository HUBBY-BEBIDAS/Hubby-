import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";
import { checkAndFirePriceAlerts } from "@/lib/price-alerts";

/**
 * Threshold para o popup de confirmação de preço no frontend:
 *   < 5%       → salva direto, sem popup
 *   5% – 14%   → popup normal
 *   ≥ 15%      → popup em vermelho com aviso destacado
 *
 * O BACKEND salva o preço independentemente — o popup é UX do frontend.
 * O endpoint retorna `change_percent` e `popup_type` para o frontend exibir
 * notificação pós-save ou para auditoria.
 */
export type PricePopupType = "none" | "normal" | "warning_red";

function getPricePopupType(changePercent: number): PricePopupType {
  if (changePercent < 5) return "none";
  if (changePercent < 15) return "normal";
  return "warning_red";
}

const VALID_CATEGORIES = [
  "beer","whisky","vodka","gin","rum","cachaca",
  "wine","sparkling","energy","soft_drink","water","juice","other",
] as const;

const VALID_PACKAGING = [
  "garrafa","lata","barril","caixa","fardo","tetra_pak","other",
] as const;

// Aceita atualização de preço apenas OU edição completa do produto
const patchProductSchema = z
  .object({
    price_cents:         z.number().int().positive().optional(),
    name:                z.string().min(1).max(200).trim().optional(),
    brand:               z.string().min(1).max(100).trim().optional(),
    category:            z.enum(VALID_CATEGORIES).optional(),
    packaging_type:      z.enum(VALID_PACKAGING).optional(),
    packaging_volume_ml: z.number().int().positive().optional(),
    available:           z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualizar",
  });

// ─── PATCH /api/distributor/products/:id ─────────────────────────────────────

export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const productId = context?.params.id;
    if (!productId) {
      return Response.json({ error: "ID do produto não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchProductSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, company_name: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, distributor_id: distributor.id },
    });
    if (!product) {
      return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const { price_cents: newPriceCents, ...otherFields } = parsed.data;
    const previousPriceCents = product.price_cents;

    // Calcula variação percentual apenas quando price_cents está presente
    const changePercent =
      newPriceCents !== undefined && previousPriceCents > 0
        ? Math.abs(((newPriceCents - previousPriceCents) * 10000) / previousPriceCents) / 100
        : 0;

    const updateData: Record<string, unknown> = { ...otherFields };
    if (newPriceCents !== undefined) {
      updateData.price_cents    = newPriceCents;
      updateData.price_updated_at = new Date();
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    await markDistributorProductsUpdated(distributor.id);

    if (newPriceCents !== undefined && newPriceCents < previousPriceCents) {
      checkAndFirePriceAlerts({
        brand: updatedProduct.brand,
        category: updatedProduct.category,
        new_price_cents: newPriceCents,
        previous_price_cents: previousPriceCents,
        distributor_name: distributor.company_name,
        distributor_id: distributor.id,
      }).catch((err) => console.error("[price-alerts]", err));
    }

    return Response.json({
      product: updatedProduct,
      previous_price_cents: previousPriceCents,
      change_percent: Math.round(changePercent * 100) / 100,
      popup_type: newPriceCents !== undefined ? getPricePopupType(changePercent) : "none",
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

// ─── DELETE /api/distributor/products/:id ────────────────────────────────────

export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const productId = context?.params.id;
    if (!productId) {
      return Response.json({ error: "ID não fornecido" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, distributor_id: distributor.id },
    });
    if (!product) {
      return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id: productId } });
    await markDistributorProductsUpdated(distributor.id);

    return Response.json({ message: "Produto removido" });
  },
  { roles: ["distributor_admin"] }
);
