import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

const MAX_ADDRESSES = 3;

const createSchema = z.object({
  label:        z.string().min(1).max(60).trim(),
  zip_code:     z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos"),
  city:         z.string().min(2).max(100).trim(),
  state:        z.string().length(2).toUpperCase(),
  address_full: z.string().min(5).max(200).trim(),
  is_default:   z.boolean().optional().default(false),
});

/**
 * GET /api/profile/addresses
 *
 * Lista os endereços de entrega cadastrados pelo comprador.
 * Exclusivo para plano Pro com status ativo.
 */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: {
        id: true,
        client_plan: true,
        client_plan_status: true,
        last_used_address_id: true,
        delivery_addresses: {
          orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
        },
      },
    });

    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const isPro = client.client_plan === "pro" && client.client_plan_status === "active";
    if (!isPro) {
      return Response.json({ error: "Múltiplos endereços disponíveis apenas no plano Pro" }, { status: 403 });
    }

    return Response.json({
      addresses: client.delivery_addresses,
      last_used_address_id: client.last_used_address_id,
    });
  },
  { roles: ["client"] }
);

/**
 * POST /api/profile/addresses
 *
 * Cria um novo endereço de entrega (máximo 3 por cliente Pro).
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: {
        id: true,
        client_plan: true,
        client_plan_status: true,
        delivery_addresses: { select: { id: true } },
      },
    });

    if (!client) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });

    const isPro = client.client_plan === "pro" && client.client_plan_status === "active";
    if (!isPro) {
      return Response.json({ error: "Múltiplos endereços disponíveis apenas no plano Pro" }, { status: 403 });
    }

    if (client.delivery_addresses.length >= MAX_ADDRESSES) {
      return Response.json(
        { error: `Limite de ${MAX_ADDRESSES} endereços atingido. Remova um para adicionar outro.` },
        { status: 422 }
      );
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const isFirst = client.delivery_addresses.length === 0;
    const makeDefault = parsed.data.is_default || isFirst;

    // Se vai ser o padrão, remove o padrão anterior
    if (makeDefault) {
      await prisma.clientDeliveryAddress.updateMany({
        where: { client_id: client.id, is_default: true },
        data:  { is_default: false },
      });
    }

    const address = await prisma.clientDeliveryAddress.create({
      data: {
        client_id:    client.id,
        label:        parsed.data.label,
        zip_code:     parsed.data.zip_code,
        city:         parsed.data.city,
        state:        parsed.data.state,
        address_full: parsed.data.address_full,
        is_default:   makeDefault,
      },
    });

    return Response.json({ address }, { status: 201 });
  },
  { roles: ["client"] }
);
