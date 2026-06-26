import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/payment-feedback
 *
 * Lista feedbacks de pagamento pendentes (e recentes) para a distribuidora autenticada.
 *
 * Query params:
 *   status?: "pending" | "all"  (padrão: "pending")
 *   page?:   número             (padrão: 1)
 *   limit?:  número             (padrão: 20)
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? "pending";
    const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const skip  = (page - 1) * limit;

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const whereStatus = statusParam === "all" ? {} : { status: "pending" };

    const [feedbacks, total] = await Promise.all([
      prisma.paymentFeedback.findMany({
        where: { distributor_id: distributor.id, ...whereStatus },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          problem_type: true,
          notes: true,
          notified_at: true,
          responded_at: true,
          created_at: true,
          order: {
            select: {
              id: true,
              total_cents: true,
              sent_at: true,
              status: true,
              client: {
                select: {
                  id: true,
                  company_name: true,
                  whatsapp: true,
                  delivery_city: true,
                  delivery_state: true,
                  hubby_score: true,
                },
              },
            },
          },
        },
      }),
      prisma.paymentFeedback.count({
        where: { distributor_id: distributor.id, ...whereStatus },
      }),
    ]);

    return Response.json({
      data: feedbacks,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
