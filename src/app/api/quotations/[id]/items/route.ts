import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { ProductCategory } from "@prisma/client";
import { deleteRankingCache } from "@/lib/ranking-cache";

const itemSchema = z.object({
  product_name: z.string().min(1).max(200),
  brand:        z.string().min(1).max(100),
  category:     z.nativeEnum(ProductCategory),
  packaging:    z.string().min(1).max(100),
  quantity:     z.number().int().min(1).max(100_000),
});

/**
 * POST /api/quotations/:id/items
 *
 * Adiciona (ou incrementa) um item em uma cotação "open" sem substituir os existentes.
 * Se já existe um item com o mesmo (product_name + brand + category + packaging), incrementa a quantidade.
 */
export const POST = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!quotation || quotation.client_id !== client.id) {
      return Response.json({ error: "Cotação não encontrada" }, { status: 404 });
    }
    if (quotation.status !== "open") {
      return Response.json({ error: "Cotação não está aberta", status: quotation.status }, { status: 409 });
    }

    const input = parsed.data;
    const key   = `${input.product_name}|${input.brand}|${input.category}|${input.packaging}`;

    // Checa se item já existe (mesmo produto)
    const existing = quotation.items.find((i) =>
      `${i.product_name}|${i.brand}|${i.category}|${i.packaging}` === key
    );

    let updated;
    if (existing) {
      updated = await prisma.$transaction(async (tx) => {
        await tx.quotationItem.update({
          where: { id: existing.id },
          data:  { quantity: existing.quantity + input.quantity },
        });
        return tx.quotation.findUnique({ where: { id }, include: { items: true } });
      });
    } else {
      updated = await prisma.$transaction(async (tx) => {
        await tx.quotationItem.create({
          data: {
            quotation_id: id,
            product_name: input.product_name,
            brand:        input.brand,
            category:     input.category,
            packaging:    input.packaging,
            quantity:     input.quantity,
          },
        });
        return tx.quotation.findUnique({ where: { id }, include: { items: true } });
      });
    }

    deleteRankingCache(id).catch(() => {});

    return Response.json({ quotation: updated }, { status: 201 });
  },
  { roles: ["client"] }
);
