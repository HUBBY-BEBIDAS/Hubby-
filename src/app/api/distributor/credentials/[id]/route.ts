import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  payment_note: z.string().max(200).nullable(),
});

/**
 * PATCH /api/distributor/credentials/:id
 *
 * Atualiza metadados editáveis de uma credencial (qualquer status).
 * Atualmente suporta apenas payment_note — anotação interna sobre prazo combinado.
 * Visível apenas para a distribuidora, nunca exposta ao comprador.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const id = context?.params.id;
    if (!id) return Response.json({ error: "ID ausente" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) return Response.json({ error: "Distribuidor não encontrado" }, { status: 404 });

    const credential = await prisma.clientCredential.findUnique({
      where: { id },
      select: { distributor_id: true },
    });
    if (!credential || credential.distributor_id !== distributor.id) {
      return Response.json({ error: "Credencial não encontrada" }, { status: 404 });
    }

    const updated = await prisma.clientCredential.update({
      where: { id },
      data: { payment_note: parsed.data.payment_note },
      select: { id: true, payment_note: true },
    });

    return Response.json(updated);
  },
  { roles: ["distributor_admin", "distributor_collaborator"] }
);
