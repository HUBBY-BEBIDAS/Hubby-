import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

function hubbyScoreLabel(score: number, hasHistory: boolean): string {
  if (!hasHistory) return "Cliente novo na plataforma";
  if (score >= 600) return "Histórico excelente na Hubby";
  if (score >= 400) return "Histórico regular na Hubby";
  return "Histórico com ocorrências — verifique antes de aprovar";
}

function monthsSince(date: Date): number {
  const now = new Date();
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

/**
 * GET /api/clients/:id/profile
 *
 * Retorna o perfil público de um comprador para distribuidoras.
 * Inclui critério Hubby, score, histórico de pagamento e estatísticas.
 *
 * Acessível apenas por distributor_admin e distributor_collaborator.
 */
export const GET = withAuth(
  async (_req: NextRequest, _user, context) => {
    const clientId = context?.params.id;
    if (!clientId) {
      return Response.json({ error: "ID do comprador não fornecido" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        company_name: true,
        cnpj: true,
        establishment_type: true,
        delivery_city: true,
        delivery_state: true,
        hubby_score: true,
        hubby_status: true,
        user: { select: { created_at: true } },
        _count: {
          select: {
            orders: true,
            client_credentials: { where: { status: "approved" } },
          },
        },
      },
    });

    if (!client) {
      return Response.json({ error: "Comprador não encontrado" }, { status: 404 });
    }

    // Contagem de feedbacks por resultado
    const [ok, late, noPay, autoOk] = await Promise.all([
      prisma.paymentFeedback.count({ where: { client_id: clientId, status: "ok" } }),
      prisma.paymentFeedback.count({ where: { client_id: clientId, status: "problem", problem_type: "late_payment" } }),
      prisma.paymentFeedback.count({ where: { client_id: clientId, status: "problem", problem_type: "no_payment" } }),
      prisma.paymentFeedback.count({ where: { client_id: clientId, status: "auto_ok" } }),
    ]);

    const totalResponded = ok + late + noPay + autoOk;
    const monthsOnPlatform = monthsSince(client.user.created_at);

    return Response.json({
      id: client.id,
      company_name: client.company_name,
      cnpj: `${client.cnpj.slice(0, 2)}.${client.cnpj.slice(2, 5)}.${client.cnpj.slice(5, 8)}/${client.cnpj.slice(8, 12)}-${client.cnpj.slice(12)}`,
      establishment_type: client.establishment_type,
      delivery_city: client.delivery_city,
      delivery_state: client.delivery_state,

      // Critério de entrada Hubby
      hubby_status: client.hubby_status,
      hubby_status_label:
        client.hubby_status === "approved_with_warning"
          ? "Aprovado com aviso"
          : "Aprovado",

      // Score interno Hubby
      hubby_score: client.hubby_score,
      hubby_score_label: hubbyScoreLabel(client.hubby_score, totalResponded > 0),

      // Atividade na plataforma
      total_orders: client._count.orders,
      distributors_approved: client._count.client_credentials,
      months_on_platform: monthsOnPlatform,

      // Histórico de pagamentos
      payment_history: {
        on_time: ok,
        late: late,
        not_paid: noPay,
        auto_ok: autoOk,
        total_responded: totalResponded,
      },
    });
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
