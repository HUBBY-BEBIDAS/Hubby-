import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { fireWebhook } from "@/lib/webhook";

export const POST = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true, webhook_url: true },
    });

    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    if (distributor.plan !== "enterprise") {
      return Response.json({ error: "Plano Enterprise necessário" }, { status: 403 });
    }
    if (!distributor.webhook_url) {
      return Response.json({ error: "Configure a URL do webhook antes de testar" }, { status: 400 });
    }

    // Força webhook_enabled=true temporariamente para o teste
    await prisma.distributor.update({
      where: { id: distributor.id },
      data: { webhook_enabled: true },
    });

    await fireWebhook({
      distributor_id: distributor.id,
      event: "test",
      data: {
        message: "Teste de integração Hubby ERP",
        order_id: "00000000-0000-0000-0000-000000000000",
        client_name: "Cliente Teste",
        total_cents: 150000,
        items: [{ product_name: "Produto Teste", quantity: 10, unit_price_cents: 15000 }],
      },
    });

    // Aguarda um instante para o log ser gravado
    await new Promise((r) => setTimeout(r, 500));

    const log = await prisma.webhookLog.findFirst({
      where: { distributor_id: distributor.id, event: "test" },
      orderBy: { created_at: "desc" },
    });

    return Response.json({
      ok: log?.success ?? false,
      status_code: log?.status_code ?? null,
      response_body: log?.response_body ?? null,
      error_message: log?.error_message ?? null,
    });
  },
  { roles: ["distributor_admin"] }
);
