/**
 * Helpers para criação de notificações in-app.
 *
 * Notificações são persistidas no banco (tabela `notifications`) e
 * consultadas via GET /api/notifications.
 */

import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "credential_approved"
  | "credential_rejected"
  | "credential_pending"
  | "new_order"
  | "order_status_updated"
  | "new_lead"
  | "new_credential_request"
  | "credential_auto_approved"
  | "credential_pending_review"
  | "price_drop"
  | "payment_feedback_request"
  | "near_expiry_alert"
  | "urgent_expiry_alert"
  | "buyer_expiry_alert";

export type NotificationData = Record<string, string | number | boolean | null>;

/**
 * Cria uma notificação in-app para um usuário.
 * Fire-and-forget: erros são silenciados para não quebrar o fluxo principal.
 */
export async function createNotification(opts: {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      user_id: opts.user_id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: opts.data ?? undefined,
    },
  });
}

// ─── Notificações para o cliente ──────────────────────────────────────────────

export async function notifyCredentialApproved(opts: {
  client_user_id: string;
  distributor_name: string;
  credential_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.client_user_id,
    type: "credential_approved",
    title: "Credenciamento aprovado!",
    body: `Seu credenciamento junto à ${opts.distributor_name} foi aprovado. Agora você pode solicitar cotações.`,
    data: { credential_id: opts.credential_id },
  });
}

export async function notifyCredentialRejected(opts: {
  client_user_id: string;
  distributor_name: string;
  credential_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.client_user_id,
    type: "credential_rejected",
    title: "Credenciamento não aprovado",
    body: `Sua solicitação de credenciamento junto à ${opts.distributor_name} não foi aprovada. Consulte seu e-mail para mais informações.`,
    data: { credential_id: opts.credential_id },
  });
}

export async function notifyCredentialPending(opts: {
  client_user_id: string;
  distributor_name: string;
  credential_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.client_user_id,
    type: "credential_pending",
    title: "Credenciamento em análise",
    body: `Sua solicitação junto à ${opts.distributor_name} está em análise. Você será notificado quando houver uma decisão.`,
    data: { credential_id: opts.credential_id },
  });
}

export async function notifyOrderStatusUpdated(opts: {
  client_user_id: string;
  distributor_name: string;
  order_id: string;
  new_status: string;
}): Promise<void> {
  const statusLabel: Record<string, string> = {
    viewed: "visualizado",
    approved: "aprovado",
    rejected: "recusado",
  };
  const label = statusLabel[opts.new_status] ?? opts.new_status;

  await createNotification({
    user_id: opts.client_user_id,
    type: "order_status_updated",
    title: `Pedido ${label}`,
    body: `Seu pedido junto à ${opts.distributor_name} foi ${label}.`,
    data: { order_id: opts.order_id, status: opts.new_status },
  });
}

// ─── Notificações para a distribuidora ───────────────────────────────────────

/** Nova cotação (pedido) recebida — principal notificação operacional. */
export async function notifyNewOrder(opts: {
  distributor_user_id: string;
  client_name: string;
  order_id: string;
  total_cents: number;
  num_items: number;
  delivery_city: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "new_order",
    title: "Nova cotação recebida",
    body: `Nova cotação recebida de ${opts.client_name} — ${opts.num_items} produto${opts.num_items !== 1 ? "s" : ""} — ${opts.delivery_city}`,
    data: { order_id: opts.order_id, total_cents: opts.total_cents },
  });
}

/** Ficha cadastral recebida — cliente solicitou credenciamento. */
export async function notifyDistributorNewCredentialRequest(opts: {
  distributor_user_id: string;
  client_name: string;
  client_cnpj: string;
  credential_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "new_credential_request",
    title: "Nova ficha cadastral recebida",
    body: `${opts.client_name} (CNPJ ${opts.client_cnpj}) enviou uma solicitação de credenciamento para análise.`,
    data: { credential_id: opts.credential_id, client_name: opts.client_name },
  });
}

/** Cliente aprovado automaticamente pelo bureau de crédito. */
export async function notifyDistributorCredentialAutoApproved(opts: {
  distributor_user_id: string;
  client_name: string;
  client_cnpj: string;
  credential_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "credential_auto_approved",
    title: "Cliente aprovado automaticamente",
    body: `${opts.client_name} (CNPJ ${opts.client_cnpj}) foi aprovado automaticamente via bureau de crédito e já pode receber cotações.`,
    data: { credential_id: opts.credential_id, client_name: opts.client_name },
  });
}

/** Solicitação de feedback de pagamento para a distribuidora. */
export async function notifyDistributorPaymentFeedback(opts: {
  distributor_user_id: string;
  client_name: string;
  order_id: string;
  total_cents: number;
}): Promise<void> {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    opts.total_cents / 100
  );
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "payment_feedback_request",
    title: "Feedback de pagamento pendente",
    body: `O pedido de ${opts.client_name} (${brl}) está aguardando seu feedback de pagamento. Acesse o painel para responder.`,
    data: { order_id: opts.order_id, total_cents: opts.total_cents },
  });
}

// ─── Notificações de vencimento ──────────────────────────────────────────────

/** Distribuidora: produtos entrando em alerta de vencimento (cron diário). */
export async function notifyDistributorNearExpiry(opts: {
  distributor_user_id: string;
  product_count: number;
  product_names: string[];
}): Promise<void> {
  const list = opts.product_names.slice(0, 3).join(", ");
  const more = opts.product_count > 3 ? ` e mais ${opts.product_count - 3}` : "";
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "near_expiry_alert",
    title: `${opts.product_count} produto${opts.product_count !== 1 ? "s" : ""} próximo${opts.product_count !== 1 ? "s" : ""} ao vencimento`,
    body: `Promoção automática ativada para: ${list}${more}. Acesse Gestão de Vencimentos para detalhes.`,
    data: { product_count: opts.product_count },
  });
}

/** Distribuidora: produto em estado urgente (≤7 dias para vencer). */
export async function notifyDistributorUrgentExpiry(opts: {
  distributor_user_id: string;
  product_name: string;
  days_left: number;
  product_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "urgent_expiry_alert",
    title: "Produto vence em breve!",
    body: `${opts.product_name} vence em ${opts.days_left} dia${opts.days_left !== 1 ? "s" : ""}. Verifique o estoque e a promoção ativa.`,
    data: { product_id: opts.product_id, days_left: opts.days_left },
  });
}

/** Comprador: distribuidora favorita tem produto com desconto urgente. */
export async function notifyBuyerExpiryOffer(opts: {
  buyer_user_id: string;
  distributor_name: string;
  product_name: string;
  discount_pct: number;
  days_left: number;
  product_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.buyer_user_id,
    type: "buyer_expiry_alert",
    title: `${opts.distributor_name} com oferta por tempo limitado`,
    body: `${opts.product_name} com ${opts.discount_pct}% de desconto — vence em ${opts.days_left} dia${opts.days_left !== 1 ? "s" : ""}. Aproveite antes que acabe!`,
    data: { product_id: opts.product_id, days_left: opts.days_left, discount_pct: opts.discount_pct },
  });
}

/** Cliente aguardando revisão manual pela distribuidora. */
export async function notifyDistributorCredentialPendingReview(opts: {
  distributor_user_id: string;
  client_name: string;
  client_cnpj: string;
  credential_id: string;
}): Promise<void> {
  await createNotification({
    user_id: opts.distributor_user_id,
    type: "credential_pending_review",
    title: "Cliente aguardando revisão manual",
    body: `${opts.client_name} (CNPJ ${opts.client_cnpj}) precisa de revisão manual. Acesse o painel para aprovar ou recusar.`,
    data: { credential_id: opts.credential_id, client_name: opts.client_name },
  });
}
