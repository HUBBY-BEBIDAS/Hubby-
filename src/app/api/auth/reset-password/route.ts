import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPasswordResetToken, deletePasswordResetToken, invalidateUserSessions } from "@/lib/redis";

const resetSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
});

export async function POST(req: NextRequest) {
  try {
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

    // Busca o token sem deletar antes de atualizar o banco
    const userId = await getPasswordResetToken(token);
    console.log("[reset-password] userId obtido do token:", userId);

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

    console.log("[reset-password] senha atualizada no banco com sucesso para:", userId);

    // Deleta o token apenas após a alteração no banco ter sucesso
    await deletePasswordResetToken(token);

    // Invalida sessões ativas do usuário sem bloquear caso o Redis falhe
    invalidateUserSessions(userId).catch((err) => {
      console.error("[reset-password] erro ao invalidar sessões:", err);
    });

    return Response.json({
      message: "Senha redefinida com sucesso. Faça login novamente.",
    });
  } catch (err: any) {
    console.error("[reset-password] erro inesperado ao redefinir senha:", err);
    return Response.json(
      { error: "Erro interno ao redefinir senha. Tente novamente." },
      { status: 500 }
    );
  }
}
