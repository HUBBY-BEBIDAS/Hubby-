import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { calculateScores, calculateBehavioralScores } from "@/lib/onboarding";

/**
 * GET /api/users/onboarding
 * Retorna as respostas e os scores do onboarding do usuário autenticado.
 */
export const GET = withAuth(async (_req: NextRequest, user) => {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { onboarding_responses: true, role: true },
  });

  if (!dbUser) {
    return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  let data = dbUser.onboarding_responses as any;
  if (data && typeof data === "object") {
    // Caso existam respostas brutas legadas, calcula os scores na hora
    if (!data.scores || !data.highlighted) {
      const rawResponses = data.responses || data;
      const results = calculateScores(rawResponses, dbUser.role);
      data = { responses: rawResponses, ...results };
    }
  }

  return Response.json({ onboarding_responses: data });
});

/**
 * POST /api/users/onboarding
 * Grava as respostas do onboarding e os scores calculados do usuário.
 * Suporta também recalcular usando dados comportamentais.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { responses, behavioral, activity } = body;

    let dbData: any;

    if (behavioral) {
      // Recalcula dinamicamente usando comportamento real na plataforma
      const results = calculateBehavioralScores(activity || {}, user.role);
      dbData = {
        responses: {},
        scores: results.scores,
        percentages: results.percentages,
        highlighted: results.highlighted,
        order: results.order,
        is_behavioral: true,
      };
    } else {
      if (!responses || typeof responses !== "object") {
        return Response.json({ error: "Respostas inválidas" }, { status: 400 });
      }
      const results = calculateScores(responses, user.role);
      dbData = {
        responses,
        scores: results.scores,
        percentages: results.percentages,
        highlighted: results.highlighted,
        order: results.order,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: { onboarding_responses: dbData },
      select: { id: true, onboarding_responses: true },
    });

    return Response.json({ success: true, onboarding_responses: updatedUser.onboarding_responses });
  } catch (error: any) {
    return Response.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
});

