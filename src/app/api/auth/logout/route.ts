import { NextRequest } from "next/server";
import * as jose from "jose";
import { blacklistToken } from "@/lib/redis";

function getPublicKey() {
  return process.env.NEXTAUTH_PUBLIC_KEY!.replace(/\\n/g, "\n");
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Token não fornecido" }, { status: 401 });
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
    // Token já expirado ou inválido — logout é sucesso de qualquer forma
    return Response.json({ message: "Logout realizado" });
  }

  const jti = payload.jti;
  const exp = payload.exp;

  if (jti && exp) {
    // Falha silenciosa se Redis estiver indisponível — o token expira em 24h de qualquer forma
    await blacklistToken(jti, exp).catch(() => {});
  }

  return Response.json({ message: "Logout realizado com sucesso" });
}
