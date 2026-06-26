import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/credentials
 *
 * Lista credenciais da distribuidora. Por padrão retorna apenas as pendentes.
 *
 * Query params:
 *   status?: "pending" | "approved" | "rejected_auto" | "rejected_manual" | "all"
 *   page?:   number (padrão 1)
 *   limit?:  number (padrão 20, máx 100)
 *
 * Não expõe bureau_response nem rejection_reason — dados internos de auditoria.
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? "pending";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const validStatuses = ["pending", "approved", "rejected_auto", "rejected_manual"];
    const whereStatus =
      statusParam === "all" || !validStatuses.includes(statusParam)
        ? undefined
        : { status: statusParam as "pending" | "approved" | "rejected_auto" | "rejected_manual" };

    const [credentials, total] = await Promise.all([
      prisma.clientCredential.findMany({
        where: { distributor_id: distributor.id, ...whereStatus },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          credit_score: true,
          review_note: true,
          payment_note: true,
          approved_at: true,
          expires_at: true,
          created_at: true,
          updated_at: true,
          client: {
            select: {
              id: true,
              company_name: true,
              cnpj: true,
              establishment_type: true,
              responsible_name: true,
              whatsapp: true,
              delivery_city: true,
              delivery_state: true,
              hubby_score: true,
              hubby_status: true,
            },
          },
        },
      }),
      prisma.clientCredential.count({
        where: { distributor_id: distributor.id, ...whereStatus },
      }),
    ]);

    return Response.json({
      data: credentials,
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
