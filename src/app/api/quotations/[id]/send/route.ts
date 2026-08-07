import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { queryBureau, evaluateCredit } from "@/lib/bureau";
import { sendWhatsApp, newOrderWhatsAppMessage } from "@/lib/whatsapp";
import {
  notifyNewOrder,
  notifyDistributorNewCredentialRequest,
  notifyDistributorCredentialAutoApproved,
  notifyDistributorCredentialPendingReview,
} from "@/lib/notifications";
import { sendOrderEmail } from "@/lib/email";
import { fireWebhook } from "@/lib/webhook";
import type { Prisma } from "@prisma/client";

function parsePortugueseDeliveryDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
  if (!match) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const currentYear = new Date().getFullYear();
  const year = match[3] ? parseInt(match[3], 10) : currentYear;
  const date = new Date(year, month, day, 12, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

// ─── Validação do body ────────────────────────────────────────────────────────

const orderItemSchema = z.object({
  product_name: z.string().min(1).max(200),
  brand: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  packaging: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(100_000),
  unit_price_cents: z.number().int().min(0),
});

const orderEntrySchema = z.object({
  distributor_id: z.string().uuid("ID da distribuidora inválido"),
  items: z.array(orderItemSchema).min(1, "Ao menos 1 item por distribuidora").max(200),
  total_cents: z.number().int().min(1, "Total deve ser maior que zero"),
  estimated_delivery_date: z.string().optional().nullable(),
  send_channel: z.enum(["whatsapp", "email", "both", "chat"]).default("both"),
});

const sendSchema = z.object({
  orders: z
    .array(orderEntrySchema)
    .min(1, "Ao menos uma distribuidora deve ser selecionada")
    .max(20, "Máximo de 20 distribuidoras por envio"),
});

function formatOrderSummaryMessage(
  clientName: string,
  distributorName: string,
  items: any[],
  totalCents: number,
  deliveryDate: string | null | undefined,
  deliveryAddress?: string | null
): string {
  const formatBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const itemsText = items
    .map((i) => `• ${i.product_name} x ${i.quantity} — ${formatBRL(i.unit_price_cents)}/un`)
    .join("\n");

  return `📦 *Novo Pedido Confirmado!*
Cliente: ${clientName}
Distribuidora: ${distributorName}
${deliveryAddress ? `📍 *Endereço de Entrega:* ${deliveryAddress}\n` : ""}${deliveryDate ? `Previsão de Entrega: ${deliveryDate}\n` : ""}
Produtos:
${itemsText}

*Total: ${formatBRL(totalCents)}*`.trim();
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type OrderResult = {
  order_id: string | null;   // null quando rejeitado (nenhum pedido criado)
  distributor_id: string;
  distributor_name: string;
  total_cents: number;
  status: "sent" | "rejected"; // "rejected" = credencial reprovada, pedido não criado
  credential_status: "approved" | "pending" | "rejected_auto" | "existing";
  estimated_delivery_date: string | null;
  room_id?: string | null;
};

/**
 * POST /api/quotations/:id/send
 *
 * Envia pedidos para uma ou múltiplas distribuidoras simultaneamente.
 *
 * Body:
 *   orders: [{ distributor_id, items, total_cents, estimated_delivery_date? }]
 *
 * Comportamento:
 *   - Gera um group_id único para agrupar todos os pedidos do lote
 *   - Cada distribuidora recebe apenas seus próprios itens
 *   - Se não há credencial aprovada: inicia credenciamento automático em paralelo
 *   - Dispara notificação WhatsApp + in-app para cada distribuidora
 *   - Fecha a cotação (status → "closed")
 */
export const POST = withAuth(
  async (req: NextRequest, user, context) => {
    const quotationId = context?.params.id;
    if (!quotationId) {
      return Response.json({ error: "ID da cotação não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // ─── Valida cotação e ownership ────────────────────────────────────────────

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        items: true,
        client: {
          select: {
            id: true,
            company_name: true,
            cnpj: true,
            whatsapp: true,
            delivery_address_full: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!quotation) {
      return Response.json({ error: "Cotação não encontrada" }, { status: 404 });
    }

    if (quotation.client.user.id !== user.userId) {
      return Response.json({ error: "Acesso não autorizado" }, { status: 403 });
    }

    // Bloqueia apenas cotações ainda em rascunho (não publicadas)
    if (quotation.status === "draft") {
      return Response.json(
        { error: "Cotação ainda em rascunho — publique antes de enviar pedidos" },
        { status: 409 }
      );
    }

    // ─── Carrega distribuidoras e verifica existência ─────────────────────────

    const distributorIds = [...new Set(parsed.data.orders.map((o) => o.distributor_id))];

    const distributors = await prisma.distributor.findMany({
      where: { id: { in: distributorIds }, approved_by_admin: true },
      select: {
        id: true,
        company_name: true,
        cnpj: true,
        whatsapp_commercial: true,
        email_commercial: true,
        credit_score_minimum: true,
        credit_accepts_restrictions: true,
        credit_min_cnpj_months: true,
        user: { select: { id: true } },
      },
    });

    const distributorMap = new Map(distributors.map((d) => [d.id, d]));
    const missingIds = distributorIds.filter((id) => !distributorMap.has(id));
    if (missingIds.length > 0) {
      return Response.json(
        { error: "Distribuidora(s) não encontrada(s) ou não aprovada(s)", ids: missingIds },
        { status: 422 }
      );
    }

    // ─── Verifica credenciais existentes em lote ───────────────────────────────

    const existingCredentials = await prisma.clientCredential.findMany({
      where: {
        client_id: quotation.client.id,
        distributor_id: { in: distributorIds },
      },
      select: { distributor_id: true, status: true, expires_at: true },
    });

    const credentialByDistributor = new Map(
      existingCredentials.map((c) => [c.distributor_id, c])
    );

    // ─── Gera group_id e cria os pedidos ──────────────────────────────────────

    const groupId = crypto.randomUUID();
    const orderResults: OrderResult[] = [];

    // Processamos cada pedido sequencialmente para manter a atomicidade de cada um
    for (const entry of parsed.data.orders) {
      const distributor = distributorMap.get(entry.distributor_id)!;

      // ── Credencial ──────────────────────────────────────────────────────────
      const existing = credentialByDistributor.get(entry.distributor_id);
      const isApproved =
        existing?.status === "approved" &&
        existing.expires_at !== null &&
        existing.expires_at > new Date();

      let credentialStatus: OrderResult["credential_status"] = "existing";

      if (!isApproved) {
        // Inicia credenciamento automático sem bloquear o pedido
        credentialStatus = await initiateCredential(
          quotation.client.id,
          entry.distributor_id,
          quotation.client.cnpj,
          distributor,
          existing,
          quotation.client.company_name
        );
      }

      // ── Credencial reprovada: não cria pedido ──────────────────────────────
      if (credentialStatus === "rejected_auto") {
        orderResults.push({
          order_id: null,
          distributor_id: entry.distributor_id,
          distributor_name: distributor.company_name,
          total_cents: entry.total_cents,
          status: "rejected",
          credential_status: credentialStatus,
          estimated_delivery_date: entry.estimated_delivery_date ?? null,
        });
        continue;
      }

      const sendChannel = entry.send_channel ?? "both";
      const sendEmail   = sendChannel === "email" || sendChannel === "both";
      const sendWpp     = sendChannel === "whatsapp" || sendChannel === "both";

      // ── Cria o pedido ───────────────────────────────────────────────────────
      const order = await prisma.order.create({
        data: {
          quotation_id: quotationId,
          client_id: quotation.client.id,
          distributor_id: entry.distributor_id,
          group_id: groupId,
          total_cents: entry.total_cents,
          items_snapshot: entry.items as unknown as Prisma.InputJsonValue,
          estimated_delivery_date: parsePortugueseDeliveryDate(entry.estimated_delivery_date),
          send_channel: sendChannel,
        },
      });

      const fullDeliveryAddress =
        quotation.client.delivery_address_full ||
        `${quotation.delivery_city} - ${quotation.delivery_state}`;

      // ── Notificações para a distribuidora ───────────────────────────────────
      const whatsappMsg = newOrderWhatsAppMessage({
        clientName: quotation.client.company_name,
        clientCnpj: quotation.client.cnpj,
        clientWhatsapp: quotation.client.whatsapp,
        distributorName: distributor.company_name,
        orderId: order.id,
        totalCents: entry.total_cents,
        items: entry.items,
        estimatedDeliveryDate: entry.estimated_delivery_date ?? null,
        deliveryAddress: fullDeliveryAddress,
      });

      // Fire-and-forget — não bloqueia a resposta se qualquer canal falhar.
      // Z-API (notificação interna de novo lead) dispara sempre.
      // Email da cotação só dispara se o comprador escolheu canal email ou ambos.
      const notifications: Promise<unknown>[] = [
        notifyNewOrder({
          distributor_user_id: distributor.user.id,
          client_name: quotation.client.company_name,
          order_id: order.id,
          total_cents: entry.total_cents,
          num_items: entry.items.length,
          delivery_city: quotation.delivery_city,
        }).catch((err) => console.error(`[send] Notification error for ${distributor.id}:`, err)),
      ];

      if (sendWpp) {
        notifications.push(
          sendWhatsApp({ to: distributor.whatsapp_commercial, text: whatsappMsg }).catch(
            (err) => console.error(`[send] WhatsApp error for ${distributor.id}:`, err)
          )
        );
      }

      if (sendEmail) {
        notifications.push(
          sendOrderEmail({
            to: distributor.email_commercial,
            clientName: quotation.client.company_name,
            clientWhatsapp: quotation.client.whatsapp,
            deliveryCity: quotation.delivery_city,
            distributorName: distributor.company_name,
            items: entry.items.map((i) => ({
              product_name: i.product_name,
              quantity: i.quantity,
              unit_price_cents: i.unit_price_cents,
            })),
            totalCents: entry.total_cents,
            deliveryAddress: fullDeliveryAddress,
          }).catch((err) => console.error(`[send] Email error for ${distributor.id}:`, err))
        );
      }

      Promise.all(notifications);

      // Dispara webhook ERP (fire-and-forget, apenas plano enterprise)
      fireWebhook({
        distributor_id: entry.distributor_id,
        event: "order_created",
        data: {
          order_id: order.id,
          group_id: groupId,
          client_name: quotation.client.company_name,
          client_cnpj: quotation.client.cnpj,
          delivery_city: quotation.delivery_city,
          delivery_state: quotation.delivery_state,
          delivery_address_full: fullDeliveryAddress,
          total_cents: entry.total_cents,
          items: entry.items,
          estimated_delivery_date: entry.estimated_delivery_date ?? null,
          sent_at: new Date().toISOString(),
        },
      }).catch(() => {});

      let roomId: string | null = null;
      if (sendChannel === "chat") {
        const room = await prisma.chatRoom.upsert({
          where: {
            client_id_distributor_id: {
              client_id: quotation.client.id,
              distributor_id: entry.distributor_id,
            },
          },
          update: {},
          create: {
            client_id: quotation.client.id,
            distributor_id: entry.distributor_id,
          },
        });

        roomId = room.id;

        const messageText = formatOrderSummaryMessage(
          quotation.client.company_name,
          distributor.company_name,
          entry.items,
          entry.total_cents,
          entry.estimated_delivery_date,
          fullDeliveryAddress
        );

        await prisma.chatMessage.create({
          data: {
            room_id: room.id,
            sender_id: user.userId,
            text: messageText,
          },
        });

        await prisma.chatRoom.update({
          where: { id: room.id },
          data: { updated_at: new Date() },
        });
      }

      orderResults.push({
        order_id: order.id,
        distributor_id: entry.distributor_id,
        distributor_name: distributor.company_name,
        total_cents: entry.total_cents,
        status: "sent",
        credential_status: credentialStatus,
        estimated_delivery_date: entry.estimated_delivery_date ?? null,
        room_id: roomId,
      });
    }

    // Fecha a cotação se pelo menos um pedido foi enviado com sucesso
    const anySent = orderResults.some((o) => o.status === "sent");
    if (anySent) {
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { status: "closed" },
      });
    }

    return Response.json(
      {
        group_id: groupId,
        quotation_id: quotationId,
        orders: orderResults,
        message: `${orderResults.length} pedido(s) enviado(s) com sucesso.`,
      },
      { status: 201 }
    );
  },
  { roles: ["client"] }
);

// ─── Helper: credenciamento automático ────────────────────────────────────────

async function initiateCredential(
  client_id: string,
  distributor_id: string,
  clientCnpj: string,
  distributor: {
    credit_score_minimum: number;
    credit_accepts_restrictions: boolean;
    credit_min_cnpj_months: number;
    user: { id: string };
    company_name: string;
  },
  existing: { status: string; expires_at: Date | null } | undefined,
  clientName: string
): Promise<OrderResult["credential_status"]> {
  try {
    // Se já existe e está pendente (não expirado), não recria
    const isPending =
      existing?.status === "pending" &&
      existing.expires_at !== null &&
      existing.expires_at > new Date();
    if (isPending) return "pending";

    // Remove credencial anterior (expirada ou reprovada) para reconsulta
    if (existing) {
      await prisma.clientCredential.delete({
        where: { client_id_distributor_id: { client_id, distributor_id } },
      });
    }

    const bureau = await queryBureau(clientCnpj);
    const decision = evaluateCredit(bureau, distributor);

    const now = new Date();
    const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

    const credential = await prisma.clientCredential.create({
      data: {
        client_id,
        distributor_id,
        credit_score: bureau.score,
        bureau_response: bureau as object,
        status:
          decision.outcome === "approved"
            ? "approved"
            : decision.outcome === "rejected_auto"
              ? "rejected_auto"
              : "pending",
        rejection_reason:
          decision.outcome === "rejected_auto" ? decision.reason : null,
        approved_at: decision.outcome === "approved" ? now : null,
        expires_at:
          decision.outcome === "rejected_auto"
            ? now
            : new Date(now.getTime() + DAYS_30),
      },
    });

    // Notifica a distribuidora sobre a ficha cadastral
    if (decision.outcome === "approved") {
      notifyDistributorCredentialAutoApproved({
        distributor_user_id: distributor.user.id,
        client_name: clientName,
        client_cnpj: clientCnpj,
        credential_id: credential.id,
      }).catch(() => {});
    } else if (decision.outcome === "pending") {
      notifyDistributorCredentialPendingReview({
        distributor_user_id: distributor.user.id,
        client_name: clientName,
        client_cnpj: clientCnpj,
        credential_id: credential.id,
      }).catch(() => {});
    }

    return decision.outcome === "approved"
      ? "approved"
      : decision.outcome === "rejected_auto"
        ? "rejected_auto"
        : "pending";
  } catch {
    return "pending";
  }
}
