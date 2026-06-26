import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { sendMail, credentialRejectedEmail, credentialApprovedEmail } from "@/lib/mailer";
import { notifyCredentialApproved, notifyCredentialRejected } from "@/lib/notifications";

const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"], {
    message: "decision deve ser 'approved' ou 'rejected'",
  }),
  note: z.string().max(500).optional(),
});

const CREDENTIAL_VALIDITY_DAYS = 30;

/**
 * PATCH /api/distributor/credentials/:id/decide
 *
 * Distribuidora aprova ou rejeita manualmente uma credencial em estado "pending".
 *
 * Body:
 *   decision: "approved" | "rejected"
 *   note?:    string (máx 500 chars) — nota interna registrada na credencial
 *
 * Regras:
 *   - Apenas credenciais com status "pending" podem ser decididas
 *   - A credencial deve pertencer à distribuidora do usuário autenticado
 *   - Aprovação: define expires_at = agora + 30 dias e notifica cliente in-app
 *   - Rejeição: notifica cliente in-app + envia e-mail com mensagem genérica
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) {
      return Response.json({ error: "ID da credencial não fornecido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = decideSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { decision, note } = parsed.data;

    // Carrega o perfil da distribuidora
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, company_name: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    // Carrega a credencial — deve pertencer a esta distribuidora e estar em "pending"
    const credential = await prisma.clientCredential.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        distributor_id: true,
        client: {
          select: {
            company_name: true,
            responsible_name: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!credential || credential.distributor_id !== distributor.id) {
      return Response.json({ error: "Credencial não encontrada" }, { status: 404 });
    }

    if (credential.status !== "pending") {
      return Response.json(
        {
          error: `Credencial não pode ser decidida — status atual: ${credential.status}`,
          current_status: credential.status,
        },
        { status: 409 }
      );
    }

    const now = new Date();

    if (decision === "approved") {
      const expiresAt = new Date(now.getTime() + CREDENTIAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

      const updated = await prisma.clientCredential.update({
        where: { id },
        data: {
          status: "approved",
          approved_at: now,
          expires_at: expiresAt,
          review_note: note ?? null,
        },
        select: {
          id: true,
          status: true,
          approved_at: true,
          expires_at: true,
          review_note: true,
        },
      });

      await notifyCredentialApproved({
        client_user_id: credential.client.user.id,
        distributor_name: distributor.company_name,
        credential_id: id,
      });

      return Response.json(updated);

    } else {
      const updated = await prisma.clientCredential.update({
        where: { id },
        data: {
          status: "rejected_manual",
          expires_at: now, // expirado imediatamente
          review_note: note ?? null,
        },
        select: {
          id: true,
          status: true,
          expires_at: true,
          review_note: true,
        },
      });

      // Notifica in-app + e-mail (mensagem genérica — sem detalhes do bureau)
      await Promise.all([
        notifyCredentialRejected({
          client_user_id: credential.client.user.id,
          distributor_name: distributor.company_name,
          credential_id: id,
        }),
        sendMail({
          to: credential.client.user.email,
          ...credentialRejectedEmail({
            clientName: credential.client.company_name,
            distributorName: distributor.company_name,
          }),
        }),
      ]);

      return Response.json(updated);
    }
  },
  { roles: ["distributor_admin"] }
);
