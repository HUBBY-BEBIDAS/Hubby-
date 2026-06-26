"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type Client = {
  id: string; company_name: string; cnpj: string;
  establishment_type: string; delivery_city: string; delivery_state: string;
  responsible_name: string; whatsapp: string; created_at: string;
  quotation_count: number; order_count: number; distributor_count: number;
  last_quotation_at: string | null;
};

const EST_LABEL: Record<string, string> = {
  bar:"Bar", restaurant:"Restaurante", adega:"Adega", hotel:"Hotel",
  nightclub:"Casa Noturna", supermarket:"Supermercado", convenience:"Conveniência", other:"Outro",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function AdminCompradoresPage() {
  const token = useApiToken();
  const [list, setList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [sort, setSort] = useState("quotations");

  function load() {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (filterType) params.set("establishment_type", filterType);
    if (filterCity) params.set("city", filterCity);
    apiFetch(`/api/admin/compradores?${params}`, { method: "GET", token })
      .then(async (r) => { if (r.ok) { const d = await r.json() as { clients: Client[] }; setList(d.clients); } })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token, sort]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Compradores</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">{list.length} compradores cadastrados</p>

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none">
          <option value="">Todos os tipos</option>
          {Object.entries(EST_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={filterCity} onChange={(e) => setFilterCity(e.target.value)}
          placeholder="Filtrar por cidade…"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none" />
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none">
          <option value="quotations">Mais cotações</option>
          <option value="orders">Mais pedidos</option>
        </select>
        <button onClick={load} className="rounded-xl bg-[#22C55E] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A34A]">Filtrar</button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {["Empresa", "Tipo", "Cidade", "Cotações", "Pedidos", "Distribuidoras", "Cadastro", "Última cotação"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#0F172A]">{c.company_name}</p>
                    <p className="text-[11px] font-medium text-slate-400">{c.cnpj}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600">{EST_LABEL[c.establishment_type] ?? c.establishment_type}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{c.delivery_city} / {c.delivery_state}</td>
                  <td className="px-4 py-3 font-bold text-[#0F172A]">{c.quotation_count}</td>
                  <td className="px-4 py-3 font-bold text-[#0F172A]">{c.order_count}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{c.distributor_count}</td>
                  <td className="px-4 py-3 font-medium text-slate-500">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-500">{formatDate(c.last_quotation_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="py-10 text-center text-sm font-medium text-slate-400">Nenhum comprador encontrado.</p>}
        </div>
      )}
    </main>
  );
}
