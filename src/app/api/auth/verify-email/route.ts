import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/redis";

const verifySchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Token inválido" }, { status: 422 });
  }

  const { token } = parsed.data;

  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    return Response.json(
      { error: "Link de verificação inválido ou expirado. Solicite um novo e-mail." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      email_verified: true,
      email_verified_at: new Date(),
    },
  });

  return Response.json({
    ok: true,
    message: "Seu e-mail foi verificado com sucesso!",
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Token não fornecido" }, { status: 400 });
  }

  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    return Response.json(
      { error: "Link de verificação inválido ou expirado. Solicite um novo e-mail." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      email_verified: true,
      email_verified_at: new Date(),
    },
  });

  return Response.json({
    ok: true,
    message: "Seu e-mail foi verificado com sucesso!",
  });
}
