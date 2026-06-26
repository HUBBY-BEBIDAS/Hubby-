import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getImportQueue, previewKey } from "@/lib/queue";

const confirmSchema = z.object({
  token: z.string().uuid("Token inválido"),
});

/**
 * POST /api/distributor/products/import/confirm
 *
 * Confirma a importação após o preview.
 * Enfileira o processamento em background via BullMQ.
 *
 * Body:
 *   token: string — retornado por /import/preview
 *
 * Resposta:
 *   job_id:  string — usar em GET /import/status/:jobId para acompanhar
 *   status:  "queued"
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Token inválido", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    const key = previewKey(distributor.id, parsed.data.token);

    // Verifica se o preview ainda existe no Redis
    const previewExists = await redis.exists(key);
    if (!previewExists) {
      return Response.json(
        {
          error:
            "Preview expirado ou inválido. Faça o upload novamente — o link expira em 30 minutos.",
        },
        { status: 400 }
      );
    }

    // Enfileira o job de importação
    const queue = getImportQueue();
    const job = await queue.add(
      "import",
      {
        distributor_id: distributor.id,
        preview_key: key,
        requested_by: user.userId,
      },
      {
        jobId: `import-${distributor.id}-${Date.now()}`,
      }
    );

    return Response.json({
      job_id: job.id,
      status: "queued",
      message:
        "Importação enfileirada. Acompanhe o progresso em GET /api/distributor/products/import/status/:jobId",
    });
  },
  { roles: ["distributor_admin"] }
);
