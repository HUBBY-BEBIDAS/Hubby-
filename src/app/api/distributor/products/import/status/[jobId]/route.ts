import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { getImportQueue } from "@/lib/queue";
import type { ImportJobResult } from "@/lib/queue";

/**
 * GET /api/distributor/products/import/status/:jobId
 *
 * Retorna o estado atual do job de importação.
 *
 * Estados possíveis:
 *   waiting     — aguardando na fila
 *   active      — processando (com progresso 0-100)
 *   completed   — concluído (com resumo: criados, atualizados, erros)
 *   failed      — falhou (com mensagem de erro)
 *   delayed     — aguardando retry
 */
export const GET = withAuth(
  async (_req: NextRequest, _user, context) => {
    const jobId = context?.params.jobId;
    if (!jobId) {
      return Response.json({ error: "ID do job não fornecido" }, { status: 400 });
    }

    const queue = getImportQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return Response.json({ error: "Job não encontrado" }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress as number;

    if (state === "completed") {
      const result = job.returnvalue as ImportJobResult;
      return Response.json({
        job_id: jobId,
        status: "completed",
        progress: 100,
        result: {
          created: result.created,
          updated: result.updated,
          failed: result.failed,
          total: result.created + result.updated + result.failed,
        },
      });
    }

    if (state === "failed") {
      return Response.json({
        job_id: jobId,
        status: "failed",
        progress,
        error: job.failedReason ?? "Erro desconhecido",
        attempts_made: job.attemptsMade,
      });
    }

    return Response.json({
      job_id: jobId,
      status: state,  // waiting | active | delayed
      progress: typeof progress === "number" ? progress : 0,
    });
  },
  { roles: ["distributor_admin"] }
);
