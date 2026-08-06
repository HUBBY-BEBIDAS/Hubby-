import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import type { Role } from "@prisma/client";

// Rotas que não exigem autenticação
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/esqueci-senha",
  "/auth/reset-password",
  "/auth/redefinir-senha",
  "/auth/verify-email",
  "/auth/verificar-email",
  "/auth/error",
  "/api/auth/login",    // login mobile — retorna JWT no body
  "/api/auth",          // NextAuth (signin, callback, csrf, session…)
  "/api/coverage/check", // consulta de cobertura pública durante cadastro
  "/api/coverage/cities", // busca pública de cidades com cobertura
  "/api/cnpj/validate", // validação pública de CNPJ no cadastro
  "/api/referrals/track", // validação pública de código de indicação
  "/sobre",
  "/planos",
  "/termos",
  "/privacidade",
];

// Roles que obrigam 2FA e são redirecionados para /auth/2fa se não verificado
const REQUIRES_2FA: Role[] = ["distributor_admin", "distributor_collaborator"];

function getPublicKey(): string | null {
  const raw = process.env.NEXTAUTH_PUBLIC_KEY;
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Responde preflights CORS antes de qualquer checagem de auth
  if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Lê o token do cookie gerenciado pelo NextAuth
  const sessionCookie = req.cookies.get("next-auth.session-token")?.value;

  // Em produção (HTTPS), NextAuth usa o cookie com prefixo __Secure-
  const secureCookie = req.cookies.get(
    "__Secure-next-auth.session-token"
  )?.value;

  const token = sessionCookie ?? secureCookie;

  const isApiRoute = pathname.startsWith("/api/");

  if (!token) {
    // "/" é pública — usuários não autenticados veem a landing page
    if (pathname === "/") return NextResponse.next();

    if (isApiRoute) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valida assinatura e expiração do JWT com RS256.
  // Nota: a blacklist do Redis NÃO é verificada aqui porque o middleware
  // roda no Edge Runtime (sem suporte a IORedis/TCP). A blacklist é
  // verificada em cada API route via withAuth(). Para a camada de páginas,
  // o token expirado em 24h limita o risco de uso indevido pós-logout.
  let payload: jose.JWTPayload;
  const rawPublicKey = getPublicKey();
  try {
    if (!rawPublicKey) {
      // Chave pública não configurada (ambiente sem .env completo):
      // trata o cookie como inválido — usuário vê a página sem proteção de auth.
      throw new Error("NEXTAUTH_PUBLIC_KEY não configurada");
    }
    const publicKey = await jose.importSPKI(rawPublicKey, "RS256");
    const result = await jose.jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
    });
    payload = result.payload;
  } catch {
    // Cookie presente mas JWT inválido/expirado/chave ausente:
    // em "/" mostra a landing page sem redirecionar.
    if (pathname === "/") return NextResponse.next();
    if (isApiRoute) {
      return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = payload.role as Role;
  const twoFactorVerified = payload.twoFactorVerified as boolean;
  const profileComplete = payload.profileComplete as boolean;

  // Distribuidoras com 2FA não verificado são redirecionadas para a tela de 2FA
  if (REQUIRES_2FA.includes(role) && !twoFactorVerified && pathname !== "/auth/2fa") {
    if (isApiRoute) {
      return NextResponse.json({ error: "2FA obrigatório" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/auth/2fa", req.url));
  }

  // Clientes com perfil incompleto só podem acessar /perfil/completar
  // e a API que cria o perfil — sem isso a chamada POST /api/profile/complete
  // seria bloqueada antes de chegar ao handler.
  const isCompletingProfile =
    pathname === "/perfil/completar" || pathname === "/api/profile/complete";
  if (role === "client" && !profileComplete && !isCompletingProfile) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Perfil incompleto" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/perfil/completar", req.url));
  }

  // Usuários autenticados na landing são redirecionados para o app
  if (pathname === "/") {
    if (role === "client" && !profileComplete) {
      return NextResponse.redirect(new URL("/perfil/completar", req.url));
    }
    const dest = role === "client" ? "/cotacao" : role === "platform_admin" ? "/admin" : "/painel";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Usuários já autenticados não devem acessar páginas de auth (exceto verificação de e-mail)
  if (pathname.startsWith("/auth/") && !pathname.startsWith("/auth/verify-email") && !pathname.startsWith("/auth/verificar-email")) {
    const dest = role === "client" ? "/cotacao" : "/painel";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica em tudo exceto arquivos estáticos e internals do Next.js
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
