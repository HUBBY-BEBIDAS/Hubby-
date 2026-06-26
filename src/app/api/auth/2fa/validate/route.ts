import { NextRequest } from "next/server";
import speakeasy from "speakeasy";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/with-auth";
import { decrypt } from "@/lib/encryption";

const validateSchema = z.object({
  code: z
    .string()
    .min(6, "Código deve ter 6 dígitos")
    .max(6, "Código deve ter 6 dígitos")
    .regex(/^\d+$/, "Código deve conter apenas números"),
  // Se true: finaliza a configuração inicial do 2FA (ativa two_factor_enabled)
  setup: z.boolean().optional().default(false),
});

/**
 * POST /api/auth/2fa/validate
 *
 * Dois usos:
 *   1. Durante setup (setup: true): valida o código e ativa o 2FA na conta.
 *   2. Na tela de 2FA pós-login (setup: false): apenas valida — o login
 *      já ocorreu pelo credentials provider com o totp incluído no body.
 *      Este endpoint existe para fluxos que precisam revalidar o TOTP
 *      sem refazer o login completo.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { code, setup } = parsed.data;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      two_factor_secret: true,
      two_factor_enabled: true,
    },
  });

  if (!dbUser?.two_factor_secret) {
    return Response.json(
      { error: "2FA não configurado — execute /api/auth/2fa/setup primeiro" },
      { status: 400 }
    );
  }

  const secret = decrypt(dbUser.two_factor_secret);

  const valid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code,
    window: 1, // tolera 30s de desvio de relógio
  });

  if (!valid) {
    return Response.json({ error: "Código inválido" }, { status: 400 });
  }

  // Ativa o 2FA se for o primeiro uso (setup)
  if (setup && !dbUser.two_factor_enabled) {
    await prisma.user.update({
      where: { id: user.userId },
      data: { two_factor_enabled: true },
    });

    return Response.json({
      message: "2FA ativado com sucesso",
      twoFactorEnabled: true,
    });
  }

  return Response.json({ valid: true });
});
