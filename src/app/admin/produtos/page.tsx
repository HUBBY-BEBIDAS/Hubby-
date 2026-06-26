"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type Product = {
  product_name: string; brand: string; category: string;
  quote_count: number; distributor_count: number;
  avg_price_cents: number | null; min_price_cents: number | null; max_price_cents: number | null;
};

const CAT_LABEL: Record<string, string> = {
  beer:"Cerveja", whisky:"Whisky", vodka:"Vodka", gin:"Gin", rum:"Rum",
  cachaca:"Cachaça", wine:"Vinho", sparkling:"Espumante", energy:"Energético",
  soft_drink:"Refrigerante", water:"Água", juice:"Suco", other:"Outro",
};

function formatBRL(cents: number | null) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function AdminProdutosPage() {
  const token = useApiToken();
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/produtos", { method: "GET", token })
      .then(async (r) => { if (r.ok) { const d = await r.json() as { products: Product[] }; setList(d.products); } })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Produtos mais cotados</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">Top 100 produtos por frequência de cotação</p>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {["#", "Produto", "Marca", "Categoria", "Cotações", "Distribuidoras", "Preço médio", "Mín", "Máx"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p, i) => (
                <tr key={`${p.brand}-${p.product_name}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-[#0F172A]">{p.product_name}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{p.brand}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {CAT_LABEL[p.category] ?? p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-[#22C55E]">{p.quote_count}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600">{p.distributor_count}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{formatBRL(p.avg_price_cents)}</td>
                  <td className="px-4 py-3 font-medium text-green-700">{formatBRL(p.min_price_cents)}</td>
                  <td className="px-4 py-3 font-medium text-red-600">{formatBRL(p.max_price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="py-10 text-center text-sm font-medium text-slate-400">Nenhum produto encontrado.</p>}
        </div>
      )}
    </main>
  );
}
