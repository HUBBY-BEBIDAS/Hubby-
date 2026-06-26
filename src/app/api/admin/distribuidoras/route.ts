import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const filterPlan   = searchParams.get("plan") ?? "";
    const filterStatus = searchParams.get("status") ?? "";
    const filterCity   = searchParams.get("city") ?? "";
    const sort         = searchParams.get("sort") ?? "orders";

    const distributors = await prisma.distributor.findMany({
      where: {
        ...(filterPlan   ? { plan: filterPlan as never } : {}),
        ...(filterStatus ? { plan_status: filterStatus as never } : {}),
      },
      select: {
        id: true, company_name: true, cnpj: true,
        plan: true, plan_status: true, plan_period: true,
        approved_by_admin: true, created_at: true,
        responsible_name: true, whatsapp_commercial: true, email_commercial: true,
        delivery_regions: { select: { city: true, state: true }, take: 1 },
        orders: { select: { id: true, client_id: true, sent_at: true }, orderBy: { sent_at: "desc" }, take: 1 },
        _count: { select: { orders: true, products: true } },
      },
    });

    let result = distributors.map((d) => ({
      id: d.id,
      company_name: d.company_name,
      cnpj: d.cnpj,
      plan: d.plan,
      plan_status: d.plan_status,
      plan_period: d.plan_period,
      approved_by_admin: d.approved_by_admin,
      created_at: d.created_at.toISOString(),
      responsible_name: d.responsible_name,
      whatsapp_commercial: d.whatsapp_commercial,
      email_commercial: d.email_commercial,
      delivery_city:  d.delivery_regions[0]?.city  ?? "—",
      delivery_state: d.delivery_regions[0]?.state ?? "—",
      order_count:   d._count.orders,
      product_count: d._count.products,
      last_order_at: d.orders[0]?.sent_at.toISOString() ?? null,
    }));

    if (filterCity) {
      result = result.filter((d) =>
        d.delivery_city.toLowerCase().includes(filterCity.toLowerCase())
      );
    }

    if (sort === "revenue") result.sort((a, b) => b.order_count - a.order_count);
    else result.sort((a, b) => b.order_count - a.order_count);

    return Response.json({ distributors: result });
  },
  { roles: ["platform_admin"] }
);
