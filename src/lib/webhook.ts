/**
 * Disparo de webhooks de saída para integração ERP.
 * Fire-and-forget — erros são logados mas não quebram o fluxo principal.
 */

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export type WebhookEvent = "order_created" | "order_status_updated" | "test";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(payload: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function fireWebhook(opts: {
  distributor_id: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
}): Promise<void> {
  const distributor = await prisma.distributor.findUnique({
    where: { id: opts.distributor_id },
    select: { webhook_url: true, webhook_secret: true, webhook_enabled: true, plan: true },
  });

  if (!distributor || !distributor.webhook_enabled || !distributor.webhook_url) return;
  if (distributor.plan !== "enterprise") return;

  const payload: WebhookPayload = {
    event: opts.event,
    timestamp: new Date().toISOString(),
    data: opts.data,
  };

  const body = JSON.stringify(payload);
  const signature = distributor.webhook_secret ? sign(body, distributor.webhook_secret) : "";

  let statusCode: number | undefined;
  let success = false;
  let responseBody: string | undefined;
  let errorMessage: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(distributor.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hubby-Signature": signature,
        "X-Hubby-Event": opts.event,
        "User-Agent": "Hubby-Webhook/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    success = res.ok;
    const text = await res.text().catch(() => "");
    responseBody = text.slice(0, 500);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    success = false;
  }

  prisma.webhookLog.create({
    data: {
      distributor_id: opts.distributor_id,
      event: opts.event,
      url: distributor.webhook_url,
      status_code: statusCode ?? null,
      success,
      response_body: responseBody ?? null,
      error_message: errorMessage ?? null,
    },
  }).catch((e) => console.error("[webhook] Erro ao salvar log:", e));
}
