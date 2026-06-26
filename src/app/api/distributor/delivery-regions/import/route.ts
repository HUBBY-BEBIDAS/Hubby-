import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { parseRegionsXlsx } from "@/lib/excel-regions-parser";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/distributor/delivery-regions/import
 *
 * Recebe multipart/form-data com campo `file` (.xlsx).
 * Faz o parse da planilha no formato padrão da distribuidora e retorna
 * o preview das regiões encontradas — sem gravar nada no banco.
 *
 * O frontend exibe o resumo, permite editar prazo/corte/mínimo e
 * confirma enviando as regiões para POST /api/distributor/delivery-regions.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json(
        { error: "Complete o cadastro do perfil antes de importar regiões" },
        { status: 404 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json(
        { error: "Envie o arquivo como multipart/form-data" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Campo 'file' não encontrado" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return Response.json(
        { error: "Formato inválido — envie um arquivo .xlsx" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `Arquivo muito grande. Máximo ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseRegionsXlsx(buffer);

    if (result.total_count === 0) {
      return Response.json(
        { error: "Nenhuma linha de dados encontrada. Verifique se a planilha está no formato correto (cabeçalho na linha 1, dias na linha 2, municípios a partir da linha 3)." },
        { status: 422 }
      );
    }

    return Response.json({
      regions: result.regions,
      summary: {
        imported: result.regions.length,
        ignored:  result.ignored_count,
        total:    result.total_count,
      },
    });
  },
  { roles: ["distributor_admin"] }
);
