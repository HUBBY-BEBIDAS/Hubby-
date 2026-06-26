import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { ensureUniqueCode, rewardDays } from "@/lib/referral";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hubby.com.br";

/**
 * GET /api/referrals
 *
 * Retorna o código de indicação do comprador (gera se não existir),
 * histórico de indicações e resumo de recompensas.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    let client = await prisma.client.findUnique({
      where:   { user_id: user.userId },
      select: {
        id: true, referral_code: true, is_ambassador: true,
        pro_expires_at: true, client_plan: true,
        referrals_made: {
          include: {
            distributor: { select: { id: true, company_name: true } },
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    // Gera código se ainda não tem
    if (!client.referral_code) {
      const code = await ensureUniqueCode();
      client = await prisma.client.update({
        where: { id: client.id },
        data:  { referral_code: code },
        select: {
          id: true, referral_code: true, is_ambassador: true,
          pro_expires_at: true, client_plan: true,
          referrals_made: {
            include: { distributor: { select: { id: true, company_name: true } } },
            orderBy: { created_at: "desc" },
          },
        },
      });
    }

    const converted = client.referrals_made.filter((r) => r.status === "converted");
    const pending   = client.referrals_made.filter((r) => r.status === "pending");

    const nextMilestone = converted.length < 3 ? converted.length + 1 : null;
    const nextRewardDays = nextMilestone !== null ? rewardDays(converted.length) : 30;

    return Response.json({
      referral_code:    client.referral_code,
      referral_link:    `${BASE_URL}/auth/register?ref=${client.referral_code}`,
      is_ambassador:    client.is_ambassador,
      pro_expires_at:   client.pro_expires_at,
      total_sent:       client.referrals_made.length,
      total_converted:  converted.length,
      total_pending:    pending.length,
      total_days_earned: converted.reduce((s, r) => s + (r.reward_days_granted ?? 0), 0),
      next_milestone:    nextMilestone,
      next_reward_days:  nextRewardDays,
      referrals:         client.referrals_made.map((r) => ({
        id:               r.id,
        distributor_name: r.distributor.company_name,
        status:           r.status,
        reward_days:      r.reward_days_granted,
        created_at:       r.created_at,
        converted_at:     r.converted_at,
      })),
    });
  },
  { roles: ["client"] }
);
