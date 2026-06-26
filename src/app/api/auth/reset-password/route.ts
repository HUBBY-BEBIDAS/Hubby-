import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken, invalidateUserSessions } from "@/lib/redis";

const resetSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { token, password } = parsed.data;

  // Consome o token (remove do Redis imediatamente — uso único)
  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return Response.json(
      { error: "Token inválido ou expirado" },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password_hash },
  });

  // Invalida todas as sessões ativas do usuário
  await invalidateUserSessions(userId);

  return Response.json({
    message: "Senha redefinida com sucesso. Faça login novamente.",
  });
}
