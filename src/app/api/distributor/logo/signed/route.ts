import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { getLogoSignedUrl } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/distributor/logo/signed?key=distributors/xxx/logo.png
 *
 * Gera uma URL de acesso assinada com expiração de 15 minutos.
 * Chamar a cada renderização que precise exibir a logo.
 *
 * Se `key` não for fornecido, usa a logo da distribuidora do usuário autenticado.
 */
export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  let key = searchParams.get("key");

  if (!key) {
    // Busca a key da distribuidora do próprio usuário
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { logo_key: true },
    });

    if (!distributor?.logo_key) {
      return Response.json({ error: "Logo não encontrada" }, { status: 404 });
    }

    key = distributor.logo_key;
  }

  // Fallback de desenvolvimento: logo armazenada como data URL diretamente no banco
  if (key.startsWith("data:")) {
    return Response.json({ url: key, expires_in_seconds: null });
  }

  try {
    const signedUrl = await getLogoSignedUrl(key);
    return Response.json({ url: signedUrl, expires_in_seconds: 900 });
  } catch {
    return Response.json({ error: "Erro ao gerar URL de acesso" }, { status: 500 });
  }
});
