import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/orders
 *
 * Lista pedidos recebidos pela distribuidora autenticada.
 * Cada distribuidora vê apenas seus próprios pedidos.
 *
 * Query params:
 *   status?: "sent" | "viewed" | "approved" | "rejected"
 *   page?:   number (padrão 1)
 *   limit?:  number (padrão 20, máx 100)
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

    const validStatuses = ["sent", "viewed", "approved", "rejected", "delivered"];
    const where = {
      distributor_id: distributor.id,
      ...(statusFilter && validStatuses.includes(statusFilter)
        ? { status: statusFilter as "sent" | "viewed" | "approved" | "rejected" | "delivered" }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { sent_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          group_id: true,
          status: true,
          total_cents: true,
          items_snapshot: true,
          estimated_delivery_date: true,
          sent_at: true,
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
              delivery_address_full: true,
            },
          },
          quotation: {
            select: { id: true, delivery_city: true, delivery_state: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return Response.json({
      data: orders,
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
