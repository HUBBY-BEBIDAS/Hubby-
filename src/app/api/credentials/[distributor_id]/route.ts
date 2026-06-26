import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/credentials/:distributor_id
 *
 * Cliente consulta o status do seu credenciamento em uma distribuidora específica.
 * Não expõe bureau_response nem rejection_reason (dados internos de auditoria).
 */
export const GET = withAuth(
  async (_req: NextRequest, user, context) => {
    const distributor_id = context?.params.distributor_id;
    if (!distributor_id) {
      return Response.json({ error: "ID da distribuidora não fornecido" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!client) {
      return Response.json({ error: "Perfil de cliente não encontrado" }, { status: 404 });
    }

    const credential = await prisma.clientCredential.findUnique({
      where: {
        client_id_distributor_id: { client_id: client.id, distributor_id },
      },
      select: {
        id: true,
        status: true,
        credit_score: true,
        approved_at: true,
        expires_at: true,
        created_at: true,
        updated_at: true,
        distributor: {
          select: { company_name: true },
        },
      },
    });

    if (!credential) {
      return Response.json({ error: "Credencial não encontrada" }, { status: 404 });
    }

    const isExpired = credential.expires_at && credential.expires_at < new Date();

    return Response.json({
      id: credential.id,
      distributor_name: credential.distributor.company_name,
      status: credential.status,
      credit_score: credential.credit_score,
      approved_at: credential.approved_at,
      expires_at: credential.expires_at,
      is_expired: isExpired,
      created_at: credential.created_at,
      updated_at: credential.updated_at,
    });
  },
  { roles: ["client"] }
);
