import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { generateMonthlyReport } from "@/lib/monthly-report";

/**
 * GET /api/reports
 * Lista os relatórios mensais do comprador autenticado (últimos 12).
 *
 * POST /api/reports
 * Gera o relatório do mês atual sob demanda (para testes / re-geração).
 */

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const reports = await prisma.monthlyReport.findMany({
      where: { client_id: client.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
      select: {
        id: true,
        month: true,
        year: true,
        total_quotations: true,
        total_orders: true,
        total_value_cents: true,
        estimated_savings_cents: true,
        avg_distributors_per_quotation: true,
        top_distributors: true,
        top_products: true,
        created_at: true,
      },
    });

    return Response.json({ reports });
  },
  { roles: ["client"] }
);

export const POST = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const now   = new Date();
    const body  = await req.json().catch(() => ({})) as { month?: number; year?: number };
    const month = body.month ?? (now.getMonth() === 0 ? 12 : now.getMonth());
    const year  = body.year  ?? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

    const reportId = await generateMonthlyReport(client.id, month, year);

    const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
    return Response.json({ ok: true, report }, { status: 201 });
  },
  { roles: ["client"] }
);
