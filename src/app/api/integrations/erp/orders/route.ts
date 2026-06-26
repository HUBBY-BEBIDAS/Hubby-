import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(["viewed", "approved", "rejected"]),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/integrations/erp/orders
 *
 * Endpoint de entrada: ERPs externos atualizam status de pedidos.
 * Autenticado via: Authorization: Bearer hubby_erpkey_...
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!apiKey.startsWith("hubby_erpkey_")) {
    return Response.json({ error: "API key inválida" }, { status: 401 });
  }

  const distributor = await prisma.distributor.findUnique({
    where: { erp_api_key: apiKey },
    select: { id: true, plan: true },
  });

  if (!distributor) return Response.json({ error: "API key não reconhecida" }, { status: 401 });
  if (distributor.plan !== "enterprise") {
    return Response.json({ error: "Plano insuficiente" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.order_id, distributor_id: distributor.id },
    select: { id: true, status: true },
  });

  if (!order) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, updated_at: true },
  });

  return Response.json({ ok: true, order: updated });
}
