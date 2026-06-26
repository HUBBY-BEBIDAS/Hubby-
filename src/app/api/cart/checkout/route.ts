import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { ProductCategory, PackagingType } from "@prisma/client";

// ─── POST /api/cart/checkout — transforma carrinho em cotação ────────────────

/**
 * Cria uma cotação a partir dos itens do carrinho do cliente.
 * Agrupa itens por produto (name+brand+category+packaging),
 * soma as quantidades de diferentes distribuidoras.
 * Limpa o carrinho após criar a cotação.
 */
export const POST = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        delivery_city: true,
        delivery_state: true,
      },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const cartItems = await prisma.cartItem.findMany({
      where: { client_id: client.id },
      include: {
        product: {
          select: {
            name:               true,
            brand:              true,
            category:           true,
            packaging_type:     true,
            packaging_volume_ml: true,
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return Response.json({ error: "Carrinho vazio" }, { status: 400 });
    }

    // Agrupa por produto (name+brand+category+packaging), soma quantidades
    type QuotItem = {
      product_name: string;
      brand:        string;
      category:     ProductCategory;
      packaging:    string;
      quantity:     number;
    };
    const map = new Map<string, QuotItem>();

    for (const item of cartItems) {
      const p = item.product;
      const packagingLabel = `${p.packaging_type} ${p.packaging_volume_ml}ml`;
      const key = `${p.name}|${p.brand}|${p.category}|${p.packaging_type}|${p.packaging_volume_ml}`;

      if (map.has(key)) {
        map.get(key)!.quantity += item.quantity;
      } else {
        map.set(key, {
          product_name: p.name,
          brand:        p.brand,
          category:     p.category as ProductCategory,
          packaging:    packagingLabel,
          quantity:     item.quantity,
        });
      }
    }

    const quotationItems = [...map.values()];

    // Cria cotação + itens numa transação, depois limpa o carrinho
    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          client_id:      client.id,
          status:         "open",
          delivery_city:  client.delivery_city,
          delivery_state: client.delivery_state,
          items: {
            create: quotationItems.map((i) => ({
              product_name: i.product_name,
              brand:        i.brand,
              category:     i.category,
              packaging:    i.packaging,
              quantity:     i.quantity,
            })),
          },
        },
        select: { id: true },
      });

      await tx.cartItem.deleteMany({ where: { client_id: client.id } });

      return q;
    });

    return Response.json({ quotation_id: quotation.id }, { status: 201 });
  },
  { roles: ["client"] }
);
