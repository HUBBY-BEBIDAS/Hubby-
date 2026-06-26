import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    label:        z.string().min(1).max(60).trim().optional(),
    address_full: z.string().min(5).max(200).trim().optional(),
    is_default:   z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualizar",
  });

/**
 * PATCH /api/profile/addresses/:id
 *
 * Atualiza label, endereço completo ou define como padrão.
 */
export const PATCH = withAuth(
  async (req: NextRequest, user, context) => {
    const addrId = context?.params.id;
    if (!addrId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const address = await prisma.clientDeliveryAddress.findFirst({
      where: { id: addrId, client_id: client.id },
    });
    if (!address) return Response.json({ error: "Endereço não encontrado" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    if (parsed.data.is_default) {
      await prisma.clientDeliveryAddress.updateMany({
        where: { client_id: client.id, is_default: true },
        data:  { is_default: false },
      });
    }

    const updated = await prisma.clientDeliveryAddress.update({
      where: { id: addrId },
      data: {
        ...(parsed.data.label        !== undefined && { label: parsed.data.label }),
        ...(parsed.data.address_full !== undefined && { address_full: parsed.data.address_full }),
        ...(parsed.data.is_default   !== undefined && { is_default: parsed.data.is_default }),
      },
    });

    return Response.json({ address: updated });
  },
  { roles: ["client"] }
);

/**
 * DELETE /api/profile/addresses/:id
 *
 * Remove um endereço. Não é possível remover o único endereço padrão se houver outros.
 * Se removido é o padrão, promove o próximo mais antigo.
 */
export const DELETE = withAuth(
  async (_req: NextRequest, user, context) => {
    const addrId = context?.params.id;
    if (!addrId) return Response.json({ error: "ID não fornecido" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: {
        id: true,
        last_used_address_id: true,
        delivery_addresses: { orderBy: { created_at: "asc" } },
      },
    });
    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const address = client.delivery_addresses.find((a) => a.id === addrId);
    if (!address) return Response.json({ error: "Endereço não encontrado" }, { status: 404 });

    await prisma.clientDeliveryAddress.delete({ where: { id: addrId } });

    // Se era o padrão, promove o próximo
    if (address.is_default) {
      const next = client.delivery_addresses.find((a) => a.id !== addrId);
      if (next) {
        await prisma.clientDeliveryAddress.update({
          where: { id: next.id },
          data:  { is_default: true },
        });
      }
    }

    // Limpa last_used_address_id se apontava para o endereço removido
    if (client.last_used_address_id === addrId) {
      await prisma.client.update({
        where: { id: client.id },
        data:  { last_used_address_id: null },
      });
    }

    return Response.json({ ok: true });
  },
  { roles: ["client"] }
);
