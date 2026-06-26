import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("establishment_type") ?? "";
    const filterCity = searchParams.get("city") ?? "";
    const sort       = searchParams.get("sort") ?? "quotations";

    const clients = await prisma.client.findMany({
      where: {
        ...(filterType ? { establishment_type: filterType as never } : {}),
        ...(filterCity ? { delivery_city: { contains: filterCity, mode: "insensitive" } } : {}),
      },
      select: {
        id: true, company_name: true, cnpj: true,
        establishment_type: true, delivery_city: true, delivery_state: true,
        responsible_name: true, whatsapp: true,
        user: { select: { created_at: true } },
        quotations: {
          select: { id: true, created_at: true },
          orderBy: { created_at: "desc" },
          take: 1,
        },
        orders: {
          select: { id: true, distributor_id: true },
        },
      },
    });

    const result = clients.map((c) => ({
      id: c.id,
      company_name: c.company_name,
      cnpj: c.cnpj,
      establishment_type: c.establishment_type,
      delivery_city: c.delivery_city,
      delivery_state: c.delivery_state,
      responsible_name: c.responsible_name,
      whatsapp: c.whatsapp,
      created_at: c.user.created_at.toISOString(),
      quotation_count: c.quotations.length,
      order_count: c.orders.length,
      distributor_count: new Set(c.orders.map((o) => o.distributor_id)).size,
      last_quotation_at: c.quotations[0]?.created_at.toISOString() ?? null,
    }));

    if (sort === "orders") result.sort((a, b) => b.order_count - a.order_count);
    else result.sort((a, b) => b.quotation_count - a.quotation_count);

    return Response.json({ clients: result });
  },
  { roles: ["platform_admin"] }
);
