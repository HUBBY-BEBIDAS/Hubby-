import { NextRequest } from "next/server";

/**
 * GET /api/auth/token
 *
 * Endpoint BFF: lê o cookie de sessão HttpOnly e devolve o JWT como string
 * para que componentes client-side possam usar o Bearer token nas chamadas de API.
 *
 * Seguro porque:
 * - O cookie HttpOnly não é legível pelo JS diretamente
 * - Esta rota só retorna o token se o cookie existir (sessão válida)
 * - Funciona apenas via Same-Origin (CSRF não é um risco — é um GET puro)
 */
export async function GET(req: NextRequest) {
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

  const token = req.cookies.get(cookieName)?.value;

  if (!token) {
    return Response.json({ token: null }, { status: 401 });
  }

  return Response.json({ token });
}
