import * as jose from "jose";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import {
  isTokenBlacklisted,
  getUserSessionInvalidatedAt,
} from "@/lib/redis";

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: Role;
  twoFactorVerified: boolean;
  jti: string;
  iat: number;
  exp: number;
};

// Next.js 16 passa params como Promise
export type RawRouteContext = { params: Promise<Record<string, string>> };
type ResolvedContext = { params: Record<string, string> };

type RouteHandler = (
  req: NextRequest,
  user: AuthenticatedUser,
  context?: ResolvedContext
) => Promise<Response>;

function getPublicKey() {
  const raw = process.env.NEXTAUTH_PUBLIC_KEY!;
  return raw.replace(/\\n/g, "\n");
}

/**
 * HOF que protege um route handler verificando:
 * 1. JWT RS256 válido no header Authorization: Bearer <token>
 * 2. Token não está na blacklist do Redis (logout)
 * 3. Token não foi emitido antes da última invalidação de sessão (troca de senha)
 * 4. Role do usuário está na lista de roles permitidas (opcional)
 *
 * Também resolve params assíncronos do Next.js 16 antes de passar ao handler,
 * e envolve o handler num try/catch para garantir que erros não tratados
 * retornem JSON em vez de resposta vazia ou HTML.
 */
export function withAuth(
  handler: RouteHandler,
  options: { roles?: Role[] } = {}
) {
  return async function (
    req: NextRequest,
    rawContext: RawRouteContext
  ): Promise<Response> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Token de autenticação não fornecido" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    let payload: jose.JWTPayload;
    try {
      const publicKey = await jose.importSPKI(getPublicKey(), "RS256");
      const result = await jose.jwtVerify(token, publicKey, {
        algorithms: ["RS256"],
      });
      payload = result.payload;
    } catch {
      return Response.json(
        { error: "Token inválido ou expirado" },
        { status: 401 }
      );
    }

    const jti = payload.jti as string;
    const userId = payload.userId as string;
    const iat = payload.iat as number;

    // Verifica blacklist (logout explícito)
    if (jti && (await isTokenBlacklisted(jti))) {
      return Response.json({ error: "Sessão encerrada" }, { status: 401 });
    }

    // Verifica invalidação por troca de senha
    const invalidatedAt = await getUserSessionInvalidatedAt(userId);
    if (invalidatedAt && iat < invalidatedAt) {
      return Response.json(
        { error: "Sessão inválida — senha alterada recentemente" },
        { status: 401 }
      );
    }

    const user: AuthenticatedUser = {
      userId,
      email: payload.email as string,
      role: payload.role as Role,
      twoFactorVerified: payload.twoFactorVerified as boolean,
      jti,
      iat,
      exp: payload.exp as number,
    };

    // Verifica roles permitidas
    if (options.roles && options.roles.length > 0) {
      if (!options.roles.includes(user.role)) {
        return Response.json(
          { error: "Acesso não autorizado para este perfil" },
          { status: 403 }
        );
      }
    }

    // Resolve params assíncronos (Next.js 16 passa params como Promise)
    const p = rawContext?.params;
    const resolvedParams = p
      ? p instanceof Promise
        ? await p
        : (p as Record<string, string>)
      : {};
    const context: ResolvedContext = { params: resolvedParams };

    // Wrap em try/catch para garantir que erros não tratados retornem JSON
    try {
      return await handler(req, user, context);
    } catch (err) {
      console.error("[withAuth] Unhandled error in route handler:", err);
      return Response.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  };
}
