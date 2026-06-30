import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

interface OrderItemSnapshot {
  product_name: string;
  brand: string;
  category?: string;
  packaging?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents?: number;
}

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    // 1. Localiza o perfil do comprador
    const client = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!client) {
      return Response.json({ error: "Perfil de comprador não encontrado" }, { status: 404 });
    }

    // 2. Busca todos os pedidos do comprador não recusados
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

    // 3. Busca todos os produtos disponíveis no catálogo geral das distribuidoras
    // para podermos calcular as médias de preços de cada produto
    const dbProducts = await prisma.product.findMany({
      where: { available: true },
      select: {
        name: true,
        brand: true,
        price_cents: true,
      },
    });

    // Agrupa preços no banco por chave normalizada: "marca|nome"
    const priceMap = new Map<string, number[]>();
    for (const p of dbProducts) {
      const key = `${p.brand.toLowerCase().trim()}|${p.name.toLowerCase().trim()}`;
      if (!priceMap.has(key)) {
        priceMap.set(key, []);
      }
      priceMap.get(key)!.push(p.price_cents);
    }

    // 4. Inicia contadores
    let totalSpentCents = 0;
    let totalSavedCents = 0;

    // Estruturas de agrupamento
    const monthlyDataMap = new Map<string, { spent: number; saved: number; count: number }>();
    const productSavingsMap = new Map<string, { name: string; brand: string; saved_cents: number }>();

    // Processa os últimos 6 meses para o histórico (de hoje para trás)
    const now = new Date();
    const monthsRange: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7); // "YYYY-MM"
      monthsRange.push(k);
      monthlyDataMap.set(k, { spent: 0, saved: 0, count: 0 });
    }

    // 5. Calcula a economia por item de cada pedido
    for (const order of orders) {
      const items = (order.items_snapshot as unknown as OrderItemSnapshot[]) || [];
      let orderSpentCents = order.total_cents;
      let orderSavedCents = 0;

      for (const item of items) {
        const itemKey = `${item.brand.toLowerCase().trim()}|${item.product_name.toLowerCase().trim()}`;
        const distributorPrices = priceMap.get(itemKey) || [];

        // Inclui o próprio preço pago para evitar médias zeradas e calcular de forma justa
        const allPricesForProduct = distributorPrices.length > 0 
          ? distributorPrices 
          : [item.unit_price_cents];

        // Média aritmética
        const avgPriceCents = allPricesForProduct.reduce((sum, p) => sum + p, 0) / allPricesForProduct.length;

        // Economia = (Média - Pago) * Quantidade (garantindo ser positivo ou zero)
        const savingPerUnitCents = avgPriceCents - item.unit_price_cents;
        const itemSavingsCents = Math.max(0, Math.round(savingPerUnitCents * item.quantity));

        orderSavedCents += itemSavingsCents;

        // Agrupamento por Produto
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

      // Agrupamento mensal
      const monthKey = order.sent_at.toISOString().slice(0, 7);
      if (monthlyDataMap.has(monthKey)) {
        const m = monthlyDataMap.get(monthKey)!;
        m.spent += orderSpentCents;
        m.saved += orderSavedCents;
        m.count += 1;
      }
    }

    // Formata o histórico mensal
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
        // Forçamos a economia mensal a ser positiva para fins de exibição amigável
        saved: Math.max(0, m.saved),
        order_count: m.count,
      };
    });

    // Formata produtos com maiores economias
    const top_products = Array.from(productSavingsMap.values())
      .filter((p) => p.saved_cents > 0)
      .sort((a, b) => b.saved_cents - a.saved_cents)
      .slice(0, 5);

    // Economia média percentual
    const totalMarketValue = totalSpentCents + totalSavedCents;
    const avg_savings_pct = totalMarketValue > 0 
      ? Math.round((Math.max(0, totalSavedCents) / totalMarketValue) * 100) 
      : 0;

    return Response.json({
      total_spent_cents: totalSpentCents,
      total_saved_cents: Math.max(0, totalSavedCents), // Garante que não apareça negativo
      avg_savings_pct,
      order_count: orders.length,
      monthly_data,
      top_products,
    });
  },
  { roles: ["client"] }
);
