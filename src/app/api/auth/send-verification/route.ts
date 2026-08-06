import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeEmailVerificationToken } from "@/lib/redis";
import { sendEmailVerificationEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      message: "Se o e-mail estiver cadastrado e pendente de verificação, um novo e-mail foi enviado.",
    });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email_verified: true },
  });

  if (!user || user.email_verified) {
    return Response.json({
      message: "Se o e-mail estiver cadastrado e pendente de verificação, um novo e-mail foi enviado.",
    });
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");

  await storeEmailVerificationToken(verificationToken, user.id);

  sendEmailVerificationEmail(email, verificationToken).catch((err) => {
    console.error("[send-verification] Erro ao enviar e-mail:", err);
  });

  return Response.json({
    message: "Se o e-mail estiver cadastrado e pendente de verificação, um novo e-mail foi enviado.",
  });
}
