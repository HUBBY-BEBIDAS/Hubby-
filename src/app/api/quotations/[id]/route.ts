import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { ProductCategory } from "@prisma/client";
import { deleteRankingCache } from "@/lib/ranking-cache";

// ─── GET /api/quotations/:id ──────────────────────────────────────────────────

/**
 * Retorna uma cotação do cliente com seus itens.
 * Acessível apenas pelo dono da cotação.
 */
export const GET = withAuth(
  async (_req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

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

    return Response.json({ quotation });
  },
  { roles: ["client"] }
);

// ─── PATCH /api/quotations/:id ────────────────────────────────────────────────

const itemSchema = z.object({
  product_name: z.string().min(1).max(200),
  brand:        z.string().min(1).max(100),
  category:     z.nativeEnum(ProductCategory),
  packaging:    z.string().min(1).max(100),
  quantity:     z.number().int().min(1).max(100_000),
});

const patchSchema = z.object({
  items:            z.array(itemSchema).min(1).max(100),
  max_delivery_days: z.number().int().min(1).max(90).nullable().optional(),
  delivery_lat:     z.number().nullable().optional(),
  delivery_lng:     z.number().nullable().optional(),
});

/**
 * PATCH /api/quotations/:id
 *
 * Atualiza os itens e parâmetros de uma cotação "open".
 * Substitui todos os itens existentes pelos novos.
 * Invalida o cache do ranking para forçar recomputação.
 *
 * Não permite editar cotações com status "closed" ou "expired".
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, client_id: true, status: true },
    });

    if (!quotation || quotation.client_id !== client.id) {
      return Response.json({ error: "Cotação não encontrada" }, { status: 404 });
    }

    if (quotation.status !== "open") {
      return Response.json(
        { error: "Apenas cotações abertas podem ser editadas", status: quotation.status },
        { status: 409 }
      );
    }

    const input = parsed.data;

    // Substitui todos os itens em uma transação
    const updated = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotation_id: id } });

      return tx.quotation.update({
        where: { id },
        data: {
          max_delivery_days: input.max_delivery_days !== undefined
            ? input.max_delivery_days
            : undefined,
          delivery_lat: input.delivery_lat ?? null,
          delivery_lng: input.delivery_lng ?? null,
          updated_at: new Date(),
          items: {
            create: input.items.map((item) => ({
              product_name: item.product_name,
              brand:        item.brand,
              category:     item.category,
              packaging:    item.packaging,
              quantity:     item.quantity,
            })),
          },
        },
        include: { items: true },
      });
    });

    // Invalida cache do ranking para forçar recomputação
    deleteRankingCache(id).catch(() => {});

    return Response.json({ quotation: updated });
  },
  { roles: ["client"] }
);

// ─── DELETE /api/quotations/:id ──────────────────────────────────────────────

/**
 * Exclui uma cotação aberta/rascunho que ainda não foi enviada.
 */
export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    try {
      const id = context?.params.id;
      if (!id) return Response.json({ error: "ID não fornecido" }, { status: 400 });

      const client = await prisma.client.findUnique({
        where: { user_id: user.userId },
        select: { id: true },
      });
      if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

      const quotation = await prisma.quotation.findUnique({
        where: { id },
        select: {
          id: true,
          client_id: true,
          status: true,
          orders: { select: { id: true } },
        },
      });

      if (!quotation || quotation.client_id !== client.id) {
        return Response.json({ error: "Cotação não encontrada" }, { status: 404 });
      }

      if (quotation.orders.length > 0) {
        if (quotation.status !== "closed") {
          await prisma.quotation.update({
            where: { id },
            data: { status: "closed" },
          });
        }
        return Response.json(
          { error: "Esta cotação já foi enviada e não pode ser excluída." },
          { status: 409 }
        );
      }

      if (quotation.status !== "open" && quotation.status !== "draft") {
        return Response.json(
          { error: "Apenas cotações não enviadas podem ser excluídas", status: quotation.status },
          { status: 409 }
        );
      }

      // Exclui a cotação (os itens serão excluídos em cascata)
      await prisma.quotation.delete({
        where: { id },
      });

      // Invalida cache do ranking
      deleteRankingCache(id).catch(() => {});

      return Response.json({ message: "Cotação excluída com sucesso" });
    } catch (err: any) {
      try {
        const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
        require("fs").writeFileSync(
          "C:\\Users\\enzog\\.gemini\\antigravity-ide\\brain\\e09a015d-a31e-4d61-bfb0-128bee7c45fa\\error.log",
          errorMsg,
          "utf-8"
        );
      } catch (e) {
        console.error("Failed to write error log:", e);
      }
      throw err;
    }
  },
  { roles: ["client"] }
);
