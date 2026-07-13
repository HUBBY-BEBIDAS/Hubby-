import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { markDistributorProductsUpdated } from "@/lib/ranking-cache";

const confirmSchema = z.object({
  token: z.string().uuid("Token inválido"),
});

function deliveryPreviewKey(distributorId: string, token: string): string {
  return `delivery-preview:${distributorId}:${token}`;
}

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
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const key = deliveryPreviewKey(distributor.id, parsed.data.token);
    const raw = await redis.get(key);
    if (!raw) {
      return Response.json(
        { error: "Preview expirado ou inválido. Faça o upload novamente." },
        { status: 400 }
      );
    }

    const { valid_rows } = JSON.parse(raw) as {
      valid_rows: Array<{
        city: string;
        state: string;
        route_days: string[];
      }>;
    };

    // Executa as transações de atualização/deleção das rotas no banco de dados
    try {
      // Como prisma.$transaction aceita array de operações Prisma, podemos executá-lo em lotes
      // Para evitar transações gigantescas que possam bloquear o banco, rodamos em lotes de 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < valid_rows.length; i += BATCH_SIZE) {
        const batch = valid_rows.slice(i, i + BATCH_SIZE);
        
        await prisma.$transaction(
          batch.map((row) => {
            if (row.route_days.length > 0) {
              return prisma.deliveryRegion.upsert({
                where: {
                  distributor_id_city_state: {
                    distributor_id: distributor.id,
                    city: row.city,
                    state: row.state,
                  },
                },
                create: {
                  distributor_id: distributor.id,
                  city: row.city,
                  state: row.state,
                  delivery_days_business: 2, // valor padrão
                  route_days: row.route_days,
                  cutoff_time: "14:00", // valor padrão
                  minimum_order_cents: 0, // valor padrão
                },
                update: {
                  route_days: row.route_days,
                },
              });
            } else {
              // Se não tem dias de rota (ex: FORA DE ROTA), remove do banco se existir
              return prisma.deliveryRegion.deleteMany({
                where: {
                  distributor_id: distributor.id,
                  city: row.city,
                  state: row.state,
                },
              });
            }
          })
        );
      }

      // Limpa chaves do cache de ranking relacionadas à distribuidora
      await markDistributorProductsUpdated(distributor.id);

      // Remove a chave do Redis
      await redis.del(key).catch(() => {});

    } catch (err: any) {
      console.error("[delivery-confirm] Erro ao salvar rotas no banco:", err);
      return Response.json(
        { error: `Falha ao salvar as rotas de entrega no banco: ${err.message}` },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "Rotas de entrega atualizadas com sucesso!"
    });
  },
  { roles: ["distributor_admin"] }
);
