import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/onboarding
 * Retorna as respostas do onboarding do usuário autenticado.
 */
export const GET = withAuth(async (_req: NextRequest, user) => {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { onboarding_responses: true },
  });

  if (!dbUser) {
    return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  return Response.json({ onboarding_responses: dbUser.onboarding_responses });
});

/**
 * POST /api/users/onboarding
 * Grava as respostas do onboarding do usuário autenticado.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const { responses } = await req.json();

    if (!responses || typeof responses !== "object") {
      return Response.json({ error: "Respostas inválidas" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: { onboarding_responses: responses },
      select: { id: true, onboarding_responses: true },
    });

    return Response.json({ success: true, onboarding_responses: updatedUser.onboarding_responses });
  } catch (error: any) {
    return Response.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
});
