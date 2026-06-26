import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const patchExpirySchema = z
  .object({
    expiry_date:        z.string().datetime({ offset: true }).nullable().optional(),
    expiry_alert_days:  z.number().int().min(1).max(365).optional(),
    expiry_discount_pct: z.number().min(0).max(99).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualizar",
  });

/**
 * PATCH /api/distributor/products/:id/expiry
 *
 * Atualiza configurações de vencimento de um produto (Enterprise only).
 * Ao limpar expiry_date, também limpa is_near_expiry e desativa NearExpiryOffer.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const productId = context?.params.id;
    if (!productId) {
      return Response.json({ error: "ID não fornecido" }, { status: 400 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true },
    });

    if (!distributor) {
      return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    }
    if (distributor.plan !== "enterprise") {
      return Response.json({ error: "Recurso exclusivo do plano Enterprise" }, { status: 403 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, distributor_id: distributor.id },
    });
    if (!product) {
      return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = patchExpirySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const data: Record<string, unknown> = {};

    if (parsed.data.expiry_date !== undefined) {
      data.expiry_date = parsed.data.expiry_date ? new Date(parsed.data.expiry_date) : null;
      if (!parsed.data.expiry_date) {
        // Limpou a data — zera flags de notificação e alerta
        data.is_near_expiry     = false;
        data.expiry_notified_at  = null;
        data.urgency_notified_at = null;
      }
    }
    if (parsed.data.expiry_alert_days !== undefined)  data.expiry_alert_days  = parsed.data.expiry_alert_days;
    if (parsed.data.expiry_discount_pct !== undefined) data.expiry_discount_pct = parsed.data.expiry_discount_pct;

    const updated = await prisma.product.update({ where: { id: productId }, data });

    // Se removeu a data de vencimento, desativa a NearExpiryOffer correspondente
    if (parsed.data.expiry_date === null) {
      await prisma.nearExpiryOffer.updateMany({
        where: { product_id: productId, distributor_id: distributor.id, active: true },
        data:  { active: false },
      });
    }

    return Response.json({ product: updated });
  },
  { roles: ["distributor_admin"] }
);
