import nodemailer from "nodemailer";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

// Sanitiza endereço de email para prevenir SMTP injection via CRLF
// (mitiga CVE em versões vulneráveis do nodemailer)
function sanitizeEmail(email: string): string {
  return email.replace(/[\r\n\t]/g, "");
}

function getFromAddress(): string {
  const from = process.env.EMAIL_FROM ?? "contato@hubby.com.br";
  if (from.includes("<")) return from;
  return `"HUBBY" <${from}>`;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
    secure: process.env.EMAIL_SMTP_SECURE === "true",
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  });
}

// ─── Email de novo pedido para a distribuidora ────────────────────────────────

type OrderEmailItem = {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
};

export async function sendOrderEmail({
  to,
  clientName,
  clientWhatsapp,
  deliveryCity,
  distributorName,
  items,
  totalCents,
  deliveryAddress,
}: {
  to: string;
  clientName: string;
  clientWhatsapp: string;
  deliveryCity: string;
  distributorName: string;
  items: OrderEmailItem[];
  totalCents: number;
  deliveryAddress?: string | null;
}): Promise<void> {
  // Em dev sem SMTP configurado: apenas loga
  if (!process.env.EMAIL_SMTP_HOST) {
    console.log(
      `[email] Pedido para ${distributorName} (${to}) | cliente: ${clientName} | total: ${formatBRL(totalCents)}`
    );
    return;
  }

  const safeEmail = sanitizeEmail(to);
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const subject = `Nova cotação recebida — ${clientName} — ${dateStr}`;

  const itemsText = items
    .map((i) => `• ${i.product_name} x ${i.quantity} — ${formatBRL(i.unit_price_cents)}/un`)
    .join("\n");

  const itemsHtml = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.product_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${i.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatBRL(i.unit_price_cents)}/un</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatBRL(i.unit_price_cents * i.quantity)}</td>
        </tr>`
    )
    .join("\n");

  const panelUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/painel`;

  const text = `
Nova cotação recebida — ${distributorName}

Cliente: ${clientName}
WhatsApp: ${clientWhatsapp}
Endereço de entrega: ${deliveryAddress ?? deliveryCity}

Produtos:
${itemsText}

Total: ${formatBRL(totalCents)}

Acesse o painel para responder: ${panelUrl}
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #DBEAFE;overflow:hidden;">
    <div style="background:#2563EB;padding:24px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#93C5FD;">HUBBY</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:900;color:#fff;">Nova cotação recebida</h1>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#0F172A;">
        <strong>${clientName}</strong> quer fazer um pedido para <strong>${distributorName}</strong>.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
        <thead>
          <tr style="background:#F5F7FB;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Produto</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Qtd</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Preço/un</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr style="background:#EFF6FF;">
            <td colspan="3" style="padding:10px 12px;font-weight:700;color:#0F172A;font-size:14px;">Total geral</td>
            <td style="padding:10px 12px;font-weight:900;color:#2563EB;font-size:16px;text-align:right;">${formatBRL(totalCents)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="background:#F5F7FB;border-radius:12px;padding:16px;margin-bottom:24px;font-size:14px;color:#475569;">
        <p style="margin:0 0 6px;"><strong>Endereço de entrega completo:</strong> ${deliveryAddress ?? deliveryCity}</p>
        <p style="margin:0;"><strong>WhatsApp do cliente:</strong> ${clientWhatsapp}</p>
      </div>

      <a href="${panelUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Ver pedido no painel →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #DBEAFE;font-size:12px;color:#94A3B8;">
      HUBBY — Plataforma B2B de cotação de bebidas
    </div>
  </div>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: safeEmail,
    subject,
    text,
    html,
  });
}

// ─── Email de solicitação de feedback de pagamento ────────────────────────────

export async function sendPaymentFeedbackEmail({
  to,
  distributorName,
  clientName,
  totalCents,
  orderId,
  sentAt,
}: {
  to: string;
  distributorName: string;
  clientName: string;
  totalCents: number;
  orderId: string;
  sentAt: Date;
}): Promise<void> {
  if (!process.env.EMAIL_SMTP_HOST) {
    console.log(
      `[email] Feedback de pagamento para ${distributorName} (${to}) | cliente: ${clientName} | pedido: ${orderId}`
    );
    return;
  }

  const safeEmail = sanitizeEmail(to);
  const dateStr = sentAt.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const panelUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/painel`;

  const text = `
HUBBY — Feedback de pagamento

Olá, ${distributorName}!

O pedido de ${clientName} no valor de ${formatBRL(totalCents)} foi enviado em ${dateStr}.

Houve algum problema com o pagamento deste pedido?

Acesse o painel para responder: ${panelUrl}

Se não houver resposta em 7 dias, o sistema registrará automaticamente como "sem problemas".
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #DBEAFE;overflow:hidden;">
    <div style="background:#2563EB;padding:24px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#93C5FD;">HUBBY</p>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:900;color:#fff;">Feedback de pagamento</h1>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#0F172A;">
        Olá, <strong>${distributorName}</strong>!
      </p>
      <div style="background:#F5F7FB;border-radius:12px;padding:16px;margin-bottom:20px;font-size:14px;color:#475569;">
        <p style="margin:0 0 6px;"><strong>Cliente:</strong> ${clientName}</p>
        <p style="margin:0 0 6px;"><strong>Valor do pedido:</strong> ${formatBRL(totalCents)}</p>
        <p style="margin:0;"><strong>Enviado em:</strong> ${dateStr}</p>
      </div>
      <p style="margin:0 0 20px;color:#0F172A;font-size:15px;">
        <strong>Houve algum problema com o pagamento deste pedido?</strong>
      </p>
      <a href="${panelUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Responder no painel →
      </a>
      <p style="margin:20px 0 0;font-size:12px;color:#94A3B8;">
        Se não houver resposta em 7 dias, o sistema registrará automaticamente como "sem problemas".
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #DBEAFE;font-size:12px;color:#94A3B8;">
      HUBBY — Plataforma B2B de cotação de bebidas
    </div>
  </div>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: safeEmail,
    subject: `Feedback de pagamento — pedido de ${clientName}`,
    text,
    html,
  });
}

// ─── Email de recuperação de senha ────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

  if (!process.env.EMAIL_SMTP_HOST) {
    console.log(`[email] Redefinição de senha para ${to} | link: ${resetUrl}`);
    return;
  }

  const safeEmail = sanitizeEmail(to);

  const text = `
HUBBY — Redefinição de Senha

Você solicitou a redefinição de senha da sua conta no HUBBY.

Clique no link abaixo para cadastrar uma nova senha (válido por 30 minutos):
${resetUrl}

Se você não solicitou essa alteração, nenhuma ação é necessária. Sua senha continuará a mesma.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #DBEAFE;overflow:hidden;">
    <div style="background:#2563EB;padding:24px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#93C5FD;">HUBBY</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:900;color:#fff;">Redefinição de Senha</h1>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#0F172A;font-size:15px;">
        Recebemos uma solicitação para redefinir a senha da sua conta no <strong>HUBBY</strong>.
      </p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;">
        Clique no botão abaixo para escolher uma nova senha. Este link é válido por <strong>30 minutos</strong>.
      </p>

      <div style="margin-bottom:24px;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
          Redefinir minha senha →
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:12px;color:#94A3B8;">
        Ou copie e cole o link no seu navegador:
      </p>
      <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#2563EB;">
        ${resetUrl}
      </p>

      <p style="margin:0;font-size:12px;color:#94A3B8;">
        Se você não solicitou esta redefinição, pode ignorar este e-mail em segurança. Sua senha não sofrerá nenhuma alteração.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #DBEAFE;font-size:12px;color:#94A3B8;">
      HUBBY — Plataforma B2B de cotação de bebidas
    </div>
  </div>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: safeEmail,
    subject: "Redefinição de senha — HUBBY",
    text,
    html,
  });
}

// ─── Email de verificação de conta ────────────────────────────────────────────

export async function sendEmailVerificationEmail(
  to: string,
  verificationToken: string
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`;

  if (!process.env.EMAIL_SMTP_HOST) {
    console.log(`[email] Verificação de e-mail para ${to} | link: ${verifyUrl}`);
    return;
  }

  const safeEmail = sanitizeEmail(to);

  const text = `
HUBBY — Confirmação de E-mail

Obrigado por se cadastrar no HUBBY!

Para ativar totalmente sua conta e garantir seu acesso, confirme seu e-mail clicando no link abaixo (válido por 24 horas):
${verifyUrl}

Se você não criou esta conta, nenhuma ação é necessária.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #DBEAFE;overflow:hidden;">
    <div style="background:#2563EB;padding:24px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#93C5FD;">HUBBY</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:900;color:#fff;">Confirme seu e-mail</h1>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#0F172A;font-size:15px;">
        Bem-vindo ao <strong>HUBBY</strong>!
      </p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;">
        Para garantir a segurança da sua conta e ter acesso completo à plataforma B2B de cotação de bebidas, confirme seu endereço de e-mail clicando no botão abaixo:
      </p>

      <div style="margin-bottom:24px;">
        <a href="${verifyUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
          Confirmar meu e-mail →
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:12px;color:#94A3B8;">
        Ou copie e cole o link no seu navegador:
      </p>
      <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#2563EB;">
        ${verifyUrl}
      </p>

      <p style="margin:0;font-size:12px;color:#94A3B8;">
        Este link expira em 24 horas. Se você não criou uma conta no HUBBY, ignore esta mensagem.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #DBEAFE;font-size:12px;color:#94A3B8;">
      HUBBY — Plataforma B2B de cotação de bebidas
    </div>
  </div>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: safeEmail,
    subject: "Confirme seu e-mail — HUBBY",
    text,
    html,
  });
}

