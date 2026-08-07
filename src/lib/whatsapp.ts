/**
 * Envio de mensagens WhatsApp Business.
 *
 * Em desenvolvimento: imprime a mensagem no terminal (mock).
 * Em produção: integrar Z-API ou Twilio WhatsApp Business API via
 *   variável de ambiente WHATSAPP_API_KEY.
 *
 * Para trocar de provider basta substituir o corpo de `sendWhatsApp`.
 */

export type WhatsAppMessage = {
  to: string;   // número no formato internacional: "5511999998888"
  text: string;
};

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:dev] → ${msg.to}\n${msg.text}\n`);
    return;
  }

  // Produção: chama Z-API ou Twilio (substitua conforme o provider escolhido)
  const apiKey = process.env.WHATSAPP_API_KEY;
  const instanceId = process.env.WHATSAPP_INSTANCE_ID;
  if (!apiKey || !instanceId) {
    throw new Error("WHATSAPP_API_KEY ou WHATSAPP_INSTANCE_ID não configurados");
  }

  // Exemplo de integração Z-API (descomentar em produção):
  // await fetch(`https://api.z-api.io/instances/${instanceId}/token/${apiKey}/send-text`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ phone: msg.to, message: msg.text }),
  // });
}

// ─── Templates ───────────────────────────────────────────────────────────────

export type OrderItem = {
  product_name: string;
  brand: string;
  packaging: string;
  quantity: number;
  unit_price_cents: number;
};

export function newOrderWhatsAppMessage(opts: {
  clientName: string;
  clientCnpj: string;
  clientWhatsapp: string;
  distributorName: string;
  orderId: string;
  totalCents: number;
  items: OrderItem[];
  estimatedDeliveryDate?: string | null;
  deliveryAddress?: string | null;
}): string {
  const brl = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const itemLines = opts.items
    .map((it) => `  • ${it.product_name} (${it.brand}) — ${it.packaging} × ${it.quantity} = ${brl(it.unit_price_cents * it.quantity)}`)
    .join("\n");

  const deliveryLine = opts.estimatedDeliveryDate
    ? `\nPrevisão de entrega: ${opts.estimatedDeliveryDate}`
    : "";

  const addressLine = opts.deliveryAddress
    ? `*Endereço de Entrega:* ${opts.deliveryAddress}\n`
    : "";

  return [
    `*Novo pedido recebido — ${opts.distributorName}*`,
    ``,
    `*Cliente:* ${opts.clientName}`,
    `*CNPJ:* ${opts.clientCnpj}`,
    `*WhatsApp:* ${opts.clientWhatsapp}`,
    addressLine ? addressLine.trim() : "",
    ``,
    `*Itens do pedido:*`,
    itemLines,
    ``,
    `*Total: ${brl(opts.totalCents)}*${deliveryLine}`,
    ``,
    `Acesse o painel para aprovar ou rejeitar: /distributor/orders/${opts.orderId}`,
  ].filter(Boolean).join("\n");
}
