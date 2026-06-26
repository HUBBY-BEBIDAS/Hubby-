import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reviews
 *
 * Cliente envia avaliação de uma distribuidora após um pedido.
 * Regras:
 *   - Uma avaliação por (client, distributor, order_id)
 *   - Pedido deve pertencer ao cliente e estar em status viewed/approved/rejected
 *   - Após salvar: recalcula average_rating e review_count da distribuidora
 *
 * GET /api/reviews?distributor_id=:id
 * Lista avaliações públicas de uma distribuidora (sem identificar o cliente).
 */

const createSchema = z.object({
  distributor_id:        z.string().uuid(),
  order_id:              z.string().uuid().optional(),
  rating:                z.number().int().min(1).max(5),
  rating_response_time:  z.number().int().min(1).max(5).optional(),
  rating_service_quality:z.number().int().min(1).max(5).optional(),
  rating_price_fairness: z.number().int().min(1).max(5).optional(),
  comment:               z.string().max(300).trim().optional(),
});

export const POST = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const d = parsed.data;

    // Valida que a distribuidora existe
    const distributor = await prisma.distributor.findUnique({
      where: { id: d.distributor_id },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    // Se order_id fornecido: valida que o pedido pertence ao cliente e à distribuidora
    if (d.order_id) {
      const order = await prisma.order.findFirst({
        where: {
          id: d.order_id,
          client_id: client.id,
          distributor_id: d.distributor_id,
          status: { in: ["viewed", "approved", "rejected"] },
        },
        select: { id: true },
      });
      if (!order) {
        return Response.json(
          { error: "Pedido não encontrado ou ainda não pode ser avaliado" },
          { status: 404 }
        );
      }
    }

    // Verifica duplicidade
    const existing = await prisma.review.findUnique({
      where: {
        client_id_distributor_id_order_id: {
          client_id: client.id,
          distributor_id: d.distributor_id,
          order_id: d.order_id ?? "",
        },
      },
    });
    if (existing) {
      return Response.json({ error: "Você já avaliou este atendimento" }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: {
        client_id:              client.id,
        distributor_id:         d.distributor_id,
        order_id:               d.order_id,
        rating:                 d.rating,
        rating_response_time:   d.rating_response_time,
        rating_service_quality: d.rating_service_quality,
        rating_price_fairness:  d.rating_price_fairness,
        comment:                d.comment,
      },
    });

    // Recalcula média e contador da distribuidora + ajusta hubby_score do comprador
    const agg = await prisma.review.aggregate({
      where: { distributor_id: d.distributor_id },
      _avg: { rating: true },
      _count: { id: true },
    });

    const reviewScoreDelta = d.rating >= 4 ? 5 : d.rating <= 2 ? -5 : 0;

    await Promise.all([
      prisma.distributor.update({
        where: { id: d.distributor_id },
        data: {
          average_rating: agg._avg.rating ?? null,
          review_count:   agg._count.id,
        },
      }),
      reviewScoreDelta !== 0
        ? prisma.client.update({
            where: { id: client.id },
            data: {
              hubby_score: {
                increment: reviewScoreDelta,
              },
            },
          })
        : Promise.resolve(),
    ]);

    return Response.json({ review }, { status: 201 });
  },
  { roles: ["client"] }
);

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get("distributor_id");
    const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "10")));

    if (!distributorId) {
      return Response.json({ error: "distributor_id obrigatório" }, { status: 400 });
    }

    const [reviews, total, stats] = await Promise.all([
      prisma.review.findMany({
        where: { distributor_id: distributorId },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rating: true,
          rating_response_time: true,
          rating_service_quality: true,
          rating_price_fairness: true,
          comment: true,
          created_at: true,
          // Não expõe client_id — anonimizado
        },
      }),
      prisma.review.count({ where: { distributor_id: distributorId } }),
      prisma.review.aggregate({
        where: { distributor_id: distributorId },
        _avg: {
          rating: true,
          rating_response_time: true,
          rating_service_quality: true,
          rating_price_fairness: true,
        },
      }),
    ]);

    return Response.json({
      reviews,
      stats: {
        total,
        average_rating:                stats._avg.rating,
        average_response_time:         stats._avg.rating_response_time,
        average_service_quality:       stats._avg.rating_service_quality,
        average_price_fairness:        stats._avg.rating_price_fairness,
      },
      pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
    });
  },
  { roles: ["client", "distributor_admin", "distributor_collaborator"] }
);
