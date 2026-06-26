import { NextRequest } from "next/server";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/with-auth";

/**
 * POST /api/auth/2fa/setup
 *
 * Gera um novo segredo TOTP, salva criptografado no banco (ainda não ativado),
 * e retorna a URI para gerar o QR code no frontend.
 *
 * Requer: Bearer token válido de um distributor_admin ou distributor_collaborator.
 */
export const POST = withAuth(
  async (_req: NextRequest, user) => {
    if (
      user.role !== "distributor_admin" &&
      user.role !== "distributor_collaborator"
    ) {
      return Response.json(
        { error: "2FA é obrigatório apenas para distribuidoras" },
        { status: 403 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, two_factor_enabled: true },
    });

    if (!dbUser) {
      return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (dbUser.two_factor_enabled) {
      return Response.json(
        { error: "2FA já está ativado nesta conta" },
        { status: 409 }
      );
    }

    // Gera segredo TOTP
    const secret = speakeasy.generateSecret({
      name: `SIC (${dbUser.email})`,
      length: 20,
    });

    // Criptografa antes de salvar
    const { encrypt } = await import("@/lib/encryption");
    const encryptedSecret = encrypt(secret.base32);

    // Salva o segredo mas não ativa ainda (two_factor_enabled permanece false)
    // A ativação ocorre após o usuário validar o primeiro código
    await prisma.user.update({
      where: { id: user.userId },
      data: { two_factor_secret: encryptedSecret },
    });

    // Gera QR code como Data URL para exibir no frontend
    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return Response.json({
      // QR code como imagem base64 — exibir com <img src={qrCodeDataUrl} />
      qrCodeDataUrl,
      // Segredo em texto para entrada manual no aplicativo
      secret: secret.base32,
    });
  }
);
