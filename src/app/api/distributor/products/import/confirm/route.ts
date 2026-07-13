import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getImportQueue, previewKey } from "@/lib/queue";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";
import type { ProductCategory, PackagingType } from "@prisma/client";
import type { ParsedRow } from "@/lib/excel-parser";

const confirmSchema = z.object({
  token: z.string().uuid("Token inválido").optional(),
  products: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      brand: z.string(),
      packaging_type: z.string(),
      packaging_volume_ml: z.number().int().min(0),
      price_cents: z.number().int().min(0),
      available: z.boolean(),
    })
  ).optional(),
});

const BATCH_SIZE = 100;

function productKey(p: {
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
}): string {
  return [
    p.name.toLowerCase().trim(),
    p.brand.toLowerCase().trim(),
    p.category,
    p.packaging_type,
    p.packaging_volume_ml,
  ].join("|");
}

/**
 * POST /api/distributor/products/import/confirm
 *
 * Confirma a importação após o preview.
 * Se os produtos forem enviados no body, executa o upsert síncrono imediatamente.
 * Caso contrário, tenta recuperar do Redis pelo token e enfileira no BullMQ (ou faz upsert síncrono se Redis estiver offline).
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
      console.error("[confirm-products] Erro de validação dos dados:", JSON.stringify(parsed.error.format(), null, 2));
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
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

    let productsToImport: any[] = [];

    // Cenário 1: Produtos enviados diretamente no corpo da requisição (Recomendado para Serverless/Vercel)
    if (parsed.data.products && parsed.data.products.length > 0) {
      productsToImport = parsed.data.products;
    } 
    // Cenário 2: Enviar apenas token (Tenta recuperar do Redis)
    else if (parsed.data.token) {
      const key = previewKey(distributor.id, parsed.data.token);
      try {
        const raw = await redis.get(key);
        if (raw) {
          const parsedData = JSON.parse(raw) as { valid_rows: ParsedRow[]; is_ai?: boolean };
          
          if (parsedData.is_ai || parsedData.valid_rows.length > 100) {
            // Se for importação por IA ou contiver muitos registros, enfileira OBRIGATORIAMENTE no BullMQ para processar em background sem timeout
            try {
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
            } catch (queueErr) {
              console.error("[confirm] Falha ao enfileirar job, tentando processar síncrono:", queueErr);
              productsToImport = parsedData.valid_rows;
              await redis.del(key).catch(() => {});
            }
          } else {
            // Caso padrão (não-IA e pequeno), processa síncrono
            productsToImport = parsedData.valid_rows;
            await redis.del(key).catch(() => {});
          }
        }
      } catch (err) {
        console.warn("[confirm] Falha ao ler do Redis, tentando enfileirar ou falhando:", err);
      }

      // Se não recuperou nada e temos apenas o token, tenta verificar no Redis
      if (productsToImport.length === 0) {
        const key = previewKey(distributor.id, parsed.data.token);
        const previewExists = await redis.exists(key).catch(() => 0);
        if (!previewExists) {
          return Response.json(
            {
              error:
                "Preview expirado ou inválido. Faça o upload novamente — o link expira em 30 minutos.",
            },
            { status: 400 }
          );
        }

        // Se o Redis está online e temos BullMQ configurado, tenta enfileirar
        try {
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
        } catch (queueErr) {
          console.error("[confirm] Falha ao enfileirar job, realizando upsert síncrono:", queueErr);
          // Caso a fila falhe (ex: Redis offline/indisponível), tentamos ler e executar síncrono
          const raw = await redis.get(key).catch(() => null);
          if (raw) {
            const parsedData = JSON.parse(raw) as { valid_rows: ParsedRow[] };
            productsToImport = parsedData.valid_rows;
            await redis.del(key).catch(() => {});
          } else {
            return Response.json(
              { error: "Erro de processamento da fila de importação e dados offline." },
              { status: 500 }
            );
          }
        }
      }
    } else {
      return Response.json(
        { error: "Forneça o 'token' ou a lista de 'products' para confirmar a importação" },
        { status: 400 }
      );
    }

    if (productsToImport.length === 0) {
      return Response.json({ error: "Nenhum produto válido para importar" }, { status: 400 });
    }

    // Executa upsert síncrono dos produtos
    const existingProducts = await prisma.product.findMany({
      where: { distributor_id: distributor.id },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        packaging_type: true,
        packaging_volume_ml: true,
      },
    });

    const existingMap = new Map<string, string>(
      existingProducts.map((p) => [productKey(p), p.id])
    );

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < productsToImport.length; i += BATCH_SIZE) {
      const batch = productsToImport.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (row) => {
          const key = productKey(row);
          const existingId = existingMap.get(key);
          try {
            if (existingId) {
              await prisma.product.update({
                where: { id: existingId },
                data: {
                  price_cents: row.price_cents,
                  available: row.available,
                  price_updated_at: new Date(),
                },
              });
              updated++;
            } else {
              const createdProd = await prisma.product.create({
                data: {
                  distributor_id: distributor.id,
                  name: row.name,
                  category: row.category as ProductCategory,
                  brand: row.brand,
                  packaging_type: row.packaging_type as PackagingType,
                  packaging_volume_ml: row.packaging_volume_ml,
                  price_cents: row.price_cents,
                  available: row.available,
                  price_updated_at: new Date(),
                },
              });
              existingMap.set(key, createdProd.id);
              created++;
            }
          } catch (err) {
            console.error(`[confirm] Erro no upsert do produto: ${row.name}`, err);
            failed++;
          }
        })
      );
    }

    // Invalida o cache de ranking
    await markDistributorProductsUpdated(distributor.id).catch(() => {});

    return Response.json({
      status: "success",
      imported: created + updated,
      created,
      updated,
      failed,
      message: `Importação realizada com sucesso! Criados: ${created}, Atualizados: ${updated}, Erros: ${failed}`,
    });
  },
  { roles: ["distributor_admin"] }
);
