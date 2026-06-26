import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit } from "@/lib/rate-limit";

const MAX_AGE = 86400; // 24h

const bodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function getPrivateKey() {
  const raw = process.env.NEXTAUTH_PRIVATE_KEY!;
  return raw.replace(/\\n/g, "\n");
}

async function generateToken(payload: jose.JWTPayload): Promise<string> {
  const privateKey = await jose.importPKCS8(getPrivateKey(), "RS256");
  const jti = crypto.randomUUID();

  return new jose.SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "RS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + MAX_AGE)
    .sign(privateKey);
}

export async function POST(req: NextRequest) {
  // Rate limiting pelo IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  const rateLimit = await checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  // Valida body
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Busca usuário com perfil relacionado para extrair o nome
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      client:      { select: { responsible_name: true } },
      distributor: { select: { responsible_name: true } },
    },
  });

  if (!user || !user.password_hash) {
    return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  // Resolve profileComplete (clientes precisam ter perfil criado)
  const profileComplete =
    user.role !== "client" ? true : !!user.client;

  // Resolve nome do perfil associado
  const name =
    user.client?.responsible_name ??
    user.distributor?.responsible_name ??
    null;

  // Gera JWT com o mesmo payload que o NextAuth usa no sistema
  const token = await generateToken({
    userId:           user.id,
    email:            user.email,
    role:             user.role,
    twoFactorVerified: true, // mobile não exige 2FA por enquanto
    profileComplete,
  });

  await prisma.user.update({
    where: { id: user.id },
    data:  { last_login_at: new Date() },
  });

  return Response.json({
    token,
    user: {
      id:    user.id,
      email: user.email,
      role:  user.role,
      name,
    },
  });
}
