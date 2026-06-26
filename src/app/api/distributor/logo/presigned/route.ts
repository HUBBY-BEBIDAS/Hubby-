import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { isStorageConfigured, getLogoUploadUrl } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

const presignedSchema = z.object({
  mime_type: z.string().min(1, "mime_type é obrigatório"),
});

/**
 * POST /api/distributor/logo/presigned
 *
 * Retorna uma URL assinada para o frontend fazer PUT direto no S3/R2.
 * Expira em 5 minutos (tempo para o upload ocorrer).
 *
 * Após o upload, o frontend inclui o `key` retornado no body do
 * POST /api/distributor/profile para associar a logo ao perfil.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = presignedSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Fallback de desenvolvimento: quando S3/R2 não está configurado,
    // sinaliza ao frontend para usar upload base64 direto no banco.
    if (!isStorageConfigured()) {
      return Response.json({ mode: "base64" });
    }

    // Busca o distributor do usuário autenticado para usar o ID na key
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    // Se a distribuidora ainda não foi criada, usa o user_id como prefixo temporário
    const distributorId = distributor?.id ?? `tmp_${user.userId}`;

    try {
      const result = await getLogoUploadUrl(distributorId, parsed.data.mime_type);
      return Response.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar URL de upload";
      return Response.json({ error: message }, { status: 400 });
    }
  },
  { roles: ["distributor_admin"] }
);
