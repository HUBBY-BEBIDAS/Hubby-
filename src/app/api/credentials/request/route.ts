import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { queryBureau, evaluateCredit } from "@/lib/bureau";
import { sendMail, credentialRejectedEmail } from "@/lib/mailer";
import {
  notifyCredentialApproved,
  notifyCredentialRejected,
  notifyCredentialPending,
  notifyDistributorNewCredentialRequest,
  notifyDistributorCredentialAutoApproved,
  notifyDistributorCredentialPendingReview,
} from "@/lib/notifications";

const requestSchema = z.object({
  distributor_id: z.string().uuid("ID da distribuidora inválido"),
});

const CREDENTIAL_VALIDITY_DAYS = 30;

/**
 * POST /api/credentials/request
 *
 * Cliente solicita credenciamento em uma distribuidora.
 * Dispara consulta automática ao bureau de crédito e decide o resultado.
 *
 * Body:
 *   distributor_id: string (UUID)
 *
 * Respostas:
 *   201 — credencial criada com status "approved" | "pending" | "rejected_auto"
 *   409 — já existe credencial ativa (não expirada) para esse par cliente/distribuidora
 *   404 — distribuidora não encontrada ou não aprovada na plataforma
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { distributor_id } = parsed.data;

    // Carrega perfil do cliente (precisa do CNPJ e nome)
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        cnpj: true,
        company_name: true,
        responsible_name: true,
        user: { select: { email: true } },
      },
    });
    if (!client) {
      return Response.json(
        { error: "Complete o cadastro do perfil antes de solicitar credenciamento" },
        { status: 404 }
      );
    }

    // Carrega distribuidora — deve estar aprovada pela plataforma
    const distributor = await prisma.distributor.findUnique({
      where: { id: distributor_id },
      select: {
        id: true,
        company_name: true,
        approved_by_admin: true,
        credit_score_minimum: true,
        credit_accepts_restrictions: true,
        credit_min_cnpj_months: true,
        user: { select: { id: true } },
      },
    });
    if (!distributor || !distributor.approved_by_admin) {
      return Response.json(
        { error: "Distribuidora não encontrada ou ainda não aprovada na plataforma" },
        { status: 404 }
      );
    }

    // Verifica se já existe credencial ativa (não expirada) ou em análise
    const existing = await prisma.clientCredential.findUnique({
      where: { client_id_distributor_id: { client_id: client.id, distributor_id } },
    });

    if (existing) {
      const isExpired = existing.expires_at && existing.expires_at < new Date();
      const isActive =
        existing.status === "approved" ||
        existing.status === "pending";

      if (isActive && !isExpired) {
        return Response.json(
          {
            error: "Já existe uma solicitação ativa para esta distribuidora",
            status: existing.status,
            expires_at: existing.expires_at,
          },
          { status: 409 }
        );
      }

      // Credencial expirada ou reprovada — exclui para criar uma nova
      await prisma.clientCredential.delete({ where: { id: existing.id } });
    }

    // ─── Consulta bureau ──────────────────────────────────────────────────────
    let bureau;
    try {
      bureau = await queryBureau(client.cnpj);
    } catch {
      return Response.json(
        { error: "Falha ao consultar bureau de crédito. Tente novamente em instantes." },
        { status: 503 }
      );
    }

    // ─── Avalia crédito ───────────────────────────────────────────────────────
    const decision = evaluateCredit(bureau, {
      credit_score_minimum: distributor.credit_score_minimum,
      credit_accepts_restrictions: distributor.credit_accepts_restrictions,
      credit_min_cnpj_months: distributor.credit_min_cnpj_months,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CREDENTIAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    // ─── Persiste a credencial ────────────────────────────────────────────────
    const credentialData = {
      client_id: client.id,
      distributor_id,
      credit_score: bureau.score,
      // bureau_response salvo como JSONB para auditoria — nunca exposto na API
      bureau_response: bureau as object,
    };

    let credential;

    if (decision.outcome === "approved") {
      credential = await prisma.clientCredential.create({
        data: {
          ...credentialData,
          status: "approved",
          approved_at: now,
          expires_at: expiresAt,
        },
      });

      // Notifica o cliente e a distribuidora
      await Promise.all([
        notifyCredentialApproved({
          client_user_id: user.userId,
          distributor_name: distributor.company_name,
          credential_id: credential.id,
        }),
        notifyDistributorCredentialAutoApproved({
          distributor_user_id: distributor.user.id,
          client_name: client.company_name,
          client_cnpj: client.cnpj,
          credential_id: credential.id,
        }),
      ]);

    } else if (decision.outcome === "rejected_auto") {
      credential = await prisma.clientCredential.create({
        data: {
          ...credentialData,
          status: "rejected_auto",
          rejection_reason: decision.reason,
          expires_at: now,
        },
      });

      // Notifica in-app + e-mail para o cliente (distribuidora não é notificada em reprovação automática)
      await Promise.all([
        notifyCredentialRejected({
          client_user_id: user.userId,
          distributor_name: distributor.company_name,
          credential_id: credential.id,
        }),
        sendMail({
          to: client.user.email,
          ...credentialRejectedEmail({
            clientName: client.company_name,
            distributorName: distributor.company_name,
          }),
        }),
      ]);

    } else {
      // pending — revisão manual pela distribuidora
      credential = await prisma.clientCredential.create({
        data: {
          ...credentialData,
          status: "pending",
          expires_at: expiresAt,
        },
      });

      // Notifica o cliente e a distribuidora
      await Promise.all([
        notifyCredentialPending({
          client_user_id: user.userId,
          distributor_name: distributor.company_name,
          credential_id: credential.id,
        }),
        notifyDistributorNewCredentialRequest({
          distributor_user_id: distributor.user.id,
          client_name: client.company_name,
          client_cnpj: client.cnpj,
          credential_id: credential.id,
        }),
        notifyDistributorCredentialPendingReview({
          distributor_user_id: distributor.user.id,
          client_name: client.company_name,
          client_cnpj: client.cnpj,
          credential_id: credential.id,
        }),
      ]);
    }

    return Response.json(
      {
        id: credential.id,
        status: credential.status,
        credit_score: credential.credit_score,
        expires_at: credential.expires_at,
        message: outcomeMessage(decision.outcome),
      },
      { status: 201 }
    );
  },
  { roles: ["client"] }
);

function outcomeMessage(outcome: string): string {
  switch (outcome) {
    case "approved":
      return "Credenciamento aprovado automaticamente. Você já pode solicitar cotações.";
    case "pending":
      return "Solicitação encaminhada para análise manual da distribuidora. Você será notificado.";
    case "rejected_auto":
      return "Credenciamento não aprovado. Consulte seu e-mail para mais informações.";
    default:
      return "";
  }
}
