import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface OrderItemSnapshot {
  product_name: string;
  brand: string;
  category?: string;
  packaging?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  beer: "Cervejas",
  whisky: "Whiskies",
  vodka: "Vodkas",
  gin: "Gins",
  rum: "Runs",
  cachaca: "Cachaças",
  wine: "Vinhos",
  sparkling: "Espumantes",
  energy: "Energéticos",
  soft_drink: "Refrigerantes",
  water: "Águas",
  juice: "Sucos",
  other: "Outros",
};

const CATEGORY_COLORS: Record<string, string> = {
  beer: "#10B981",       // Esmeralda
  whisky: "#F59E0B",     // Âmbar
  vodka: "#3B82F6",      // Azul
  gin: "#8B5CF6",       // Roxo
  rum: "#EC4899",       // Rosa
  cachaca: "#EF4444",   // Vermelho
  wine: "#6366F1",      // Índigo
  sparkling: "#06B6D4",  // Ciano
  energy: "#F43F5E",    // Rosa escuro
  soft_drink: "#14B8A6", // Teal
  water: "#38BDF8",     // Sky blue
  juice: "#A3E635",     // Lime
  other: "#64748B",     // Slate
};

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "barjoao@cliente.seed.hubby" },
  });
  if (!user) {
    console.error("User not found");
    return;
  }

  const client = await prisma.client.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  });

  if (!client) {
    console.error("Client profile not found");
    return;
  }

  try {
    console.log("Fetching orders...");
    const orders = await prisma.order.findMany({
      where: {
        client_id: client.id,
        status: { not: "rejected" },
      },
      select: {
        id: true,
        group_id: true,
        total_cents: true,
        items_snapshot: true,
        sent_at: true,
        status: true,
        distributor: {
          select: { company_name: true },
        },
      },
      orderBy: { sent_at: "desc" },
    });

    console.log(`Fetched ${orders.length} orders`);

    console.log("Fetching available products...");
    const dbProducts = await prisma.product.findMany({
      where: { available: true },
      select: {
        name: true,
        brand: true,
        price_cents: true,
      },
    });

    console.log(`Fetched ${dbProducts.length} products`);

    const priceMap = new Map<string, number[]>();
    for (const p of dbProducts) {
      const key = `${p.brand.toLowerCase().trim()}|${p.name.toLowerCase().trim()}`;
      if (!priceMap.has(key)) {
        priceMap.set(key, []);
      }
      priceMap.get(key)!.push(p.price_cents);
    }

    let totalSpentCents = 0;
    let totalSavedCents = 0;

    const monthlyDataMap = new Map<string, { spent: number; saved: number; count: number }>();
    const categorySavingsMap = new Map<string, number>();
    const productSavingsMap = new Map<string, { name: string; brand: string; saved_cents: number }>();
    const recentOrdersWithSavings: any[] = [];

    const now = new Date();
    const monthsRange: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7); // "YYYY-MM"
      monthsRange.push(k);
      monthlyDataMap.set(k, { spent: 0, saved: 0, count: 0 });
    }

    console.log("Processing orders...");
    for (const order of orders) {
      const items = (order.items_snapshot as unknown as OrderItemSnapshot[]) || [];
      let orderSpentCents = order.total_cents;
      let orderSavedCents = 0;

      for (const item of items) {
        const itemKey = `${item.brand.toLowerCase().trim()}|${item.product_name.toLowerCase().trim()}`;
        const distributorPrices = priceMap.get(itemKey) || [];

        const allPricesForProduct = distributorPrices.length > 0 
          ? distributorPrices 
          : [item.unit_price_cents];

        const avgPriceCents = allPricesForProduct.reduce((sum, p) => sum + p, 0) / allPricesForProduct.length;
        const savingPerUnitCents = avgPriceCents - item.unit_price_cents;
        const itemSavingsCents = Math.round(savingPerUnitCents * item.quantity);

        orderSavedCents += itemSavingsCents;

        const cat = item.category || "other";
        const currentCatSavings = categorySavingsMap.get(cat) || 0;
        categorySavingsMap.set(cat, currentCatSavings + itemSavingsCents);

        const prodKey = `${item.brand}|${item.product_name}`;
        const existingProd = productSavingsMap.get(prodKey) || {
          name: item.product_name,
          brand: item.brand,
          saved_cents: 0,
        };
        existingProd.saved_cents += itemSavingsCents;
        productSavingsMap.set(prodKey, existingProd);
      }

      totalSpentCents += orderSpentCents;
      totalSavedCents += orderSavedCents;

      const monthKey = order.sent_at.toISOString().slice(0, 7);
      if (monthlyDataMap.has(monthKey)) {
        const m = monthlyDataMap.get(monthKey)!;
        m.spent += orderSpentCents;
        m.saved += orderSavedCents;
        m.count += 1;
      }

      if (recentOrdersWithSavings.length < 5) {
        recentOrdersWithSavings.push({
          id: order.id,
          group_id: order.group_id,
          sent_at: order.sent_at.toISOString(),
          spent_cents: orderSpentCents,
          saved_cents: orderSavedCents,
          status: order.status,
          distributor_name: order.distributor.company_name,
        });
      }
    }

    console.log("Formatting monthly_data...");
    const monthly_data = monthsRange.map((k) => {
      const [year, month] = k.split("-");
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(new Date(Number(year), Number(month) - 1, 1))
        .toUpperCase()
        .replace(".", "");

      const m = monthlyDataMap.get(k)!;
      return {
        monthKey: k,
        monthLabel: label,
        spent: m.spent,
        saved: m.saved,
        order_count: m.count,
      };
    });

    console.log("Formatting category_data...");
    const category_data = Array.from(categorySavingsMap.entries())
      .map(([cat, cents]) => {
        const label = CATEGORY_LABELS[cat] || "Outros";
        const color = CATEGORY_COLORS[cat] || "#64748B";
        return {
          category: cat,
          name: label,
          value: Math.max(0, cents),
          color,
        };
      })
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    console.log("Formatting top_products...");
    const top_products = Array.from(productSavingsMap.values())
      .filter((p) => p.saved_cents > 0)
      .sort((a, b) => b.saved_cents - a.saved_cents)
      .slice(0, 5);

    const totalMarketValue = totalSpentCents + totalSavedCents;
    const avg_savings_pct = totalMarketValue > 0 
      ? Math.round((totalSavedCents / totalMarketValue) * 100) 
      : 0;

    console.log("API logic success! Result:", {
      total_spent_cents: totalSpentCents,
      total_saved_cents: totalSavedCents,
      avg_savings_pct,
      order_count: orders.length,
      monthly_data,
      category_data,
      top_products,
      recent_orders_count: recentOrdersWithSavings.length
    });
  } catch (error) {
    console.error("API Logic failed with error:", error);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
