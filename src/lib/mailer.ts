/**
 * Envio de e-mails transacionais.
 *
 * Em desenvolvimento: usa o transport "console" — imprime o e-mail no terminal.
 * Em produção: configura SMTP via variáveis de ambiente (EMAIL_HOST, EMAIL_PORT,
 *   EMAIL_USER, EMAIL_PASS) ou serviços como SendGrid / Amazon SES via SMTP relay.
 *
 * Para trocar para SendGrid:
 *   npm install @sendgrid/mail
 *   e substituir o transport pelo SDK do SendGrid.
 */

import nodemailer from "nodemailer";

function createTransport() {
  if (process.env.NODE_ENV === "production") {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST!,
      port: Number(process.env.EMAIL_PORT ?? 587),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER!,
        pass: process.env.EMAIL_PASS!,
      },
    });
  }

  // Desenvolvimento: imprime no terminal sem enviar de verdade
  return nodemailer.createTransport({ jsonTransport: true });
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "SIC <contato@sic.com.br>";

export type MailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(opts: MailOptions): Promise<void> {
  const transport = createTransport();
  const info = await transport.sendMail({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[mailer:dev] E-mail simulado:", JSON.parse((info as unknown as { message: string }).message));
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function credentialRejectedEmail(opts: {
  clientName: string;
  distributorName: string;
}): Pick<MailOptions, "subject" | "html"> {
  return {
    subject: "Resultado da solicitação de credenciamento — SIC",
    html: `
      <p>Olá, <strong>${opts.clientName}</strong>.</p>

      <p>Sua solicitação de credenciamento junto à distribuidora
      <strong>${opts.distributorName}</strong> foi <strong>não aprovada</strong>.</p>

      <p>Por questões de política de crédito, não podemos divulgar os detalhes
      desta decisão. Caso acredite que há um erro, entre em contato conosco.</p>

      <p>Atenciosamente,<br/>Equipe SIC</p>
    `,
  };
}

export function credentialApprovedEmail(opts: {
  clientName: string;
  distributorName: string;
}): Pick<MailOptions, "subject" | "html"> {
  return {
    subject: "Credenciamento aprovado — SIC",
    html: `
      <p>Olá, <strong>${opts.clientName}</strong>.</p>

      <p>Sua solicitação de credenciamento junto à distribuidora
      <strong>${opts.distributorName}</strong> foi <strong>aprovada</strong>!</p>

      <p>Agora você pode solicitar cotações e efetuar pedidos diretamente com essa distribuidora.</p>

      <p>Atenciosamente,<br/>Equipe SIC</p>
    `,
  };
}
