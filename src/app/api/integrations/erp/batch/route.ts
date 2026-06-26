import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const batchSchema = z.object({
  product_id:   z.string().uuid(),
  batch_number: z.string().min(1).max(100),
  expiry_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
  quantity:     z.number().int().positive(),
});

/**
 * POST /api/integrations/erp/batch
 *
 * Recebe dados de lote do ERP da distribuidora e atualiza expiry_date do produto.
 * Autenticação via header: Authorization: Bearer <erp_api_key>
 *
 * Payload: { product_id, batch_number, expiry_date, quantity }
 *
 * Exclusivo para distribuidoras Enterprise com erp_api_key configurada.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey) {
    return Response.json({ error: "Chave de API não fornecida" }, { status: 401 });
  }

  const distributor = await prisma.distributor.findFirst({
    where: { erp_api_key: apiKey },
    select: { id: true, plan: true, company_name: true },
  });

  if (!distributor) {
    return Response.json({ error: "Chave de API inválida" }, { status: 401 });
  }

  if (distributor.plan !== "enterprise") {
    return Response.json({ error: "Integração ERP de lote disponível apenas no plano Enterprise" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { product_id, expiry_date, quantity } = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: product_id, distributor_id: distributor.id },
    select: { id: true, name: true, expiry_date: true },
  });

  if (!product) {
    return Response.json({ error: "Produto não encontrado para esta distribuidora" }, { status: 404 });
  }

  const newExpiryDate = new Date(expiry_date);

  // Atualiza expiry_date e reseta flags de notificação (novo lote = novo ciclo)
  const updated = await prisma.product.update({
    where: { id: product_id },
    data: {
      expiry_date:         newExpiryDate,
      is_near_expiry:      false,
      expiry_notified_at:  null,
      urgency_notified_at: null,
    },
    select: {
      id: true,
      name: true,
      expiry_date: true,
      expiry_alert_days: true,
      expiry_discount_pct: true,
    },
  });

  console.log(
    `[erp/batch] ${distributor.company_name} → produto "${product.name}" ` +
    `lote vence ${expiry_date} | qtd=${quantity}`
  );

  return Response.json({ ok: true, product: updated }, { status: 200 });
}
