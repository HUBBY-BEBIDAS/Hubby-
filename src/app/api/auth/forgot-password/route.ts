import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storePasswordResetToken } from "@/lib/redis";
import { sendPasswordResetEmail } from "@/lib/email";

const forgotSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    // Sempre retorna 200 para não revelar se o email existe
    return Response.json({
      message: "Se o email estiver cadastrado, você receberá um link em instantes.",
    });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, provider: true },
  });

  // Não revela existência do email — resposta idêntica independente do resultado
  if (!user || user.provider !== "credentials") {
    return Response.json({
      message: "Se o email estiver cadastrado, você receberá um link em instantes.",
    });
  }

  // Token criptograficamente seguro de 32 bytes
  const resetToken = crypto.randomBytes(32).toString("hex");

  await storePasswordResetToken(resetToken, user.id);

  // Dispara email em background — não bloqueia a resposta
  sendPasswordResetEmail(email, resetToken).catch((err) => {
    console.error("[forgot-password] Erro ao enviar email:", err);
  });

  return Response.json({
    message: "Se o email estiver cadastrado, você receberá um link em instantes.",
  });
}
