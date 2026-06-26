import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/pesquisa
 * Retorna resultados agregados da pesquisa de onboarding.
 */
export const GET = withAuth(
  async () => {
    const [total, skipped, surveys] = await Promise.all([
      prisma.onboardingSurvey.count(),
      prisma.onboardingSurvey.count({ where: { skipped: true } }),
      prisma.onboardingSurvey.findMany({
        where: { skipped: false },
        select: {
          orders_per_month:    true,
          monthly_spend_range: true,
          distributors_count:  true,
          referral_source:     true,
          main_pain:           true,
          beverage_types:      true,
        },
      }),
    ]);

    function countField(field: (string | null)[]): Record<string, number> {
      const counts: Record<string, number> = {};
      for (const v of field) {
        if (v) counts[v] = (counts[v] ?? 0) + 1;
      }
      return counts;
    }

    function countMulti(arrays: unknown[][]): Record<string, number> {
      const counts: Record<string, number> = {};
      for (const arr of arrays) {
        for (const v of arr) {
          if (typeof v === "string") counts[v] = (counts[v] ?? 0) + 1;
        }
      }
      return counts;
    }

    const answered = total - skipped;

    return Response.json({
      total,
      answered,
      skipped,
      response_rate: total > 0 ? Math.round((answered / total) * 100) : 0,
      breakdown: {
        orders_per_month:    countField(surveys.map((s) => s.orders_per_month)),
        monthly_spend_range: countField(surveys.map((s) => s.monthly_spend_range)),
        distributors_count:  countField(surveys.map((s) => s.distributors_count)),
        referral_source:     countField(surveys.map((s) => s.referral_source)),
        main_pain:           countField(surveys.map((s) => s.main_pain)),
        beverage_types:      countMulti(surveys.map((s) => s.beverage_types as unknown[])),
      },
    });
  },
  { roles: ["platform_admin"] }
);
