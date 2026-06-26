import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const PLAN_ALLOWS_TEAM = ["pro", "business", "enterprise"];

const inviteSchema = z.object({
  invited_email:              z.string().email().toLowerCase().trim(),
  role_label:                 z.enum(["vendedor", "supervisor", "atendimento"]).default("vendedor"),
  role_scope:                 z.enum(["all_clients", "assigned_clients"]).default("all_clients"),
  assigned_client_ids:        z.array(z.string().uuid()).default([]),
  sales_target_monthly_cents: z.number().int().positive().optional().nullable(),
});

/**
 * GET /api/distributor/team
 * Admin: lista todos os membros com métricas do mês corrente.
 * Colaborador: retorna apenas seus próprios dados.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    // Distributor admin
    if (user.role === "distributor_admin") {
      const distributor = await prisma.distributor.findUnique({
        where:  { user_id: user.userId },
        select: { id: true, plan: true },
      });
      if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

      const planAllows = PLAN_ALLOWS_TEAM.includes(distributor.plan);

      const members = await prisma.distributorTeamMember.findMany({
        where:   { distributor_id: distributor.id },
        include: { user: { select: { id: true, email: true } } },
        orderBy: { invited_at: "asc" },
      });

      // Calcula métricas do mês corrente para cada membro
      const now            = new Date();
      const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);

      const membersWithMetrics = await Promise.all(
        members.map(async (m) => {
          const clientFilter =
            m.role_scope === "assigned_clients" && m.assigned_client_ids.length > 0
              ? { client_id: { in: m.assigned_client_ids } }
              : {};

          const [orderCount, orderValue] = await Promise.all([
            prisma.order.count({
              where: {
                distributor_id: distributor.id,
                sent_at: { gte: startOfMonth },
                ...clientFilter,
              },
            }),
            prisma.order.aggregate({
              where: {
                distributor_id: distributor.id,
                sent_at: { gte: startOfMonth },
                ...clientFilter,
              },
              _sum: { total_cents: true },
            }),
          ]);

          const valueCents = orderValue._sum.total_cents ?? 0;
          const targetPct  = m.sales_target_monthly_cents
            ? Math.round((valueCents / m.sales_target_monthly_cents) * 100)
            : null;

          const badge: string =
            targetPct === null   ? "sem_meta"
            : targetPct >= 100   ? "acima_meta"
            : targetPct >= 80    ? "em_dia"
            : "abaixo_meta";

          return {
            ...m,
            orders_this_month:         orderCount,
            value_this_month_cents:    valueCents,
            target_pct:                targetPct,
            performance_badge:         badge,
          };
        })
      );

      return Response.json({ members: membersWithMetrics, plan_allows_team: planAllows });
    }

    // Colaborador: ver apenas seus próprios dados
    if (user.role === "distributor_collaborator") {
      const membership = await prisma.distributorTeamMember.findFirst({
        where:   { user_id: user.userId, status: "active" },
        include: { distributor: { select: { id: true, company_name: true } } },
      });
      if (!membership) return Response.json({ error: "Membro não encontrado" }, { status: 404 });

      const now          = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const clientFilter =
        membership.role_scope === "assigned_clients" && membership.assigned_client_ids.length > 0
          ? { client_id: { in: membership.assigned_client_ids } }
          : {};

      const [orderCount, orderValue, recentOrders] = await Promise.all([
        prisma.order.count({
          where: { distributor_id: membership.distributor.id, sent_at: { gte: startOfMonth }, ...clientFilter },
        }),
        prisma.order.aggregate({
          where: { distributor_id: membership.distributor.id, sent_at: { gte: startOfMonth }, ...clientFilter },
          _sum: { total_cents: true },
        }),
        prisma.order.findMany({
          where: { distributor_id: membership.distributor.id, sent_at: { gte: startOfMonth }, ...clientFilter },
          select: {
            id: true, total_cents: true, status: true, sent_at: true,
            client: { select: { company_name: true, delivery_city: true } },
          },
          orderBy: { sent_at: "desc" },
          take: 20,
        }),
      ]);

      const valueCents = orderValue._sum.total_cents ?? 0;
      const targetPct  = membership.sales_target_monthly_cents
        ? Math.round((valueCents / membership.sales_target_monthly_cents) * 100)
        : null;

      return Response.json({
        membership,
        orders_this_month:      orderCount,
        value_this_month_cents: valueCents,
        target_pct:             targetPct,
        recent_orders:          recentOrders,
      });
    }

    return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);

/**
 * POST /api/distributor/team
 * Convida um novo membro (apenas admin).
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where:  { user_id: user.userId },
      select: { id: true, plan: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidora não encontrada" }, { status: 404 });

    if (!PLAN_ALLOWS_TEAM.includes(distributor.plan)) {
      return Response.json(
        { error: "Gestão de equipe disponível a partir do plano Pro" },
        { status: 403 }
      );
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    // Verifica se já existe
    const existing = await prisma.distributorTeamMember.findUnique({
      where: { distributor_id_invited_email: { distributor_id: distributor.id, invited_email: parsed.data.invited_email } },
    });
    if (existing) {
      return Response.json({ error: "Este e-mail já foi convidado para a equipe" }, { status: 409 });
    }

    // Verifica se o usuário já existe no sistema
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.invited_email },
      select: { id: true },
    });

    const member = await prisma.distributorTeamMember.create({
      data: {
        distributor_id:             distributor.id,
        user_id:                    existingUser?.id ?? null,
        invited_email:              parsed.data.invited_email,
        role_label:                 parsed.data.role_label,
        role_scope:                 parsed.data.role_scope,
        assigned_client_ids:        parsed.data.assigned_client_ids,
        sales_target_monthly_cents: parsed.data.sales_target_monthly_cents ?? null,
        status:                     existingUser ? "active" : "pending",
        joined_at:                  existingUser ? new Date() : null,
      },
    });

    return Response.json({ member }, { status: 201 });
  },
  { roles: ["distributor_admin"] }
);
