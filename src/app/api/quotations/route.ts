import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { ProductCategory } from "@prisma/client";

const itemSchema = z.object({
  product_name: z.string().min(1, "Nome do produto é obrigatório").max(200),
  brand: z.string().min(1, "Marca é obrigatória").max(100),
  category: z.nativeEnum(ProductCategory, {
    message: "Categoria inválida",
  }),
  packaging: z.string().min(1, "Embalagem é obrigatória").max(100),
  quantity: z
    .number({ message: "Quantidade deve ser um número" })
    .int()
    .min(1, "Quantidade mínima: 1")
    .max(100_000, "Quantidade máxima: 100.000"),
});

const createQuotationSchema = z.object({
  items: z
    .array(itemSchema)
    .min(1, "Inclua ao menos um item na cotação")
    .max(100, "Máximo de 100 itens por cotação"),
  max_delivery_days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .nullable(),
  // Endereço de entrega Pro (UUID de ClientDeliveryAddress)
  delivery_address_id: z.string().uuid().optional().nullable(),
  // Localidade de entrega (opcional — usa o padrão do cadastro do cliente se omitido)
  delivery_city: z.string().min(2).optional(),
  delivery_state: z.string().length(2).toUpperCase().optional(),
  // Coordenadas para cálculo de distância (opcional)
  delivery_lat: z.number().optional().nullable(),
  delivery_lng: z.number().optional().nullable(),
});

/**
 * POST /api/quotations
 *
 * Cria uma nova cotação com status "open".
 * O ranking é computado sob demanda via GET /api/quotations/:id/ranking.
 */
export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = createQuotationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // Busca o perfil do cliente para pegar a localidade padrão
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: {
        id: true,
        delivery_city: true,
        delivery_state: true,
        max_delivery_days_default: true,
        client_plan: true,
        client_plan_status: true,
      },
    });

    if (!client) {
      return Response.json(
        { error: "Complete o cadastro do seu perfil antes de criar cotações" },
        { status: 404 }
      );
    }

    const isPro = client.client_plan === "pro" && client.client_plan_status === "active";

    // Resolve endereço via ClientDeliveryAddress (Pro) ou fallback do perfil
    let delivery_city  = input.delivery_city  ?? client.delivery_city;
    let delivery_state = input.delivery_state ?? client.delivery_state;

    if (input.delivery_address_id && isPro) {
      const addr = await prisma.clientDeliveryAddress.findFirst({
        where: { id: input.delivery_address_id, client_id: client.id },
        select: { city: true, state: true },
      });
      if (addr) {
        delivery_city  = addr.city;
        delivery_state = addr.state;
        // Persiste o último endereço usado
        await prisma.client.update({
          where: { id: client.id },
          data:  { last_used_address_id: input.delivery_address_id },
        });
      }
    }

    // Plano Free: só pode cotar na própria cidade de entrega cadastrada
    if (!isPro && input.delivery_city) {
      const sameCity  = input.delivery_city.trim().toLowerCase()  === client.delivery_city.trim().toLowerCase();
      const sameState = (input.delivery_state ?? client.delivery_state).toUpperCase() === client.delivery_state.toUpperCase();
      if (!sameCity || !sameState) {
        return Response.json(
          {
            error: "Cotações em regiões diferentes da sua cidade estão disponíveis apenas no plano Pro.",
            upgrade_required: true,
          },
          { status: 403 }
        );
      }
    }
    const max_delivery_days =
      input.max_delivery_days !== undefined
        ? input.max_delivery_days
        : (client.max_delivery_days_default ?? null);

    const quotation = await prisma.quotation.create({
      data: {
        client_id: client.id,
        status: "open",
        delivery_city,
        delivery_state,
        max_delivery_days,
        delivery_lat: input.delivery_lat ?? null,
        delivery_lng: input.delivery_lng ?? null,
        items: {
          create: input.items.map((item) => ({
            product_name: item.product_name,
            brand: item.brand,
            category: item.category,
            packaging: item.packaging,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return Response.json({ quotation }, { status: 201 });
  },
  { roles: ["client"] }
);

/**
 * GET /api/quotations
 *
 * Lista as cotações do cliente autenticado.
 */
export const GET = withAuth(
  async (req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!client) {
      return Response.json({ quotations: [] });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const quotations = await prisma.quotation.findMany({
      where: {
        client_id: client.id,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        items: true,
        orders: { select: { id: true, status: true, distributor_id: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return Response.json({ quotations });
  },
  { roles: ["client"] }
);
