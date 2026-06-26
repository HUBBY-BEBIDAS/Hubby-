import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/distributors
 *
 * Lista distribuidoras aguardando aprovação (platform_admin).
 *
 * Query params:
 *   approved?: "true" | "false" | "all" (padrão "false" — apenas pendentes)
 *   page?:     number (padrão 1)
 *   limit?:    number (padrão 20, máx 100)
 */
export const GET = withAuth(
  async (req: NextRequest, _user) => {
    const { searchParams } = new URL(req.url);
    const approvedParam = searchParams.get("approved") ?? "false";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

    const approvedFilter =
      approvedParam === "all"
        ? {}
        : { approved_by_admin: approvedParam !== "false" };

    const [distributors, total] = await Promise.all([
      prisma.distributor.findMany({
        where: approvedFilter,
        orderBy: { created_at: "asc" }, // mais antigos primeiro (ordem de fila)
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          company_name: true,
          cnpj: true,
          cnpj_status: true,
          cnpj_verified_at: true,
          responsible_name: true,
          email_commercial: true,
          whatsapp_commercial: true,
          plan: true,
          plan_status: true,
          approved_by_admin: true,
          created_at: true,
          user: { select: { email: true, created_at: true } },
          _count: {
            select: { products: true, delivery_regions: true },
          },
        },
      }),
      prisma.distributor.count({ where: approvedFilter }),
    ]);

    return Response.json({
      data: distributors,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  },
  { roles: ["platform_admin"] }
);
