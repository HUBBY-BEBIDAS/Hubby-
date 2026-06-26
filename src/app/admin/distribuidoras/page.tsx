"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type Distributor = {
  id: string; company_name: string; cnpj: string;
  plan: string; plan_status: string; plan_period: string;
  approved_by_admin: boolean; created_at: string;
  delivery_city: string; delivery_state: string;
  order_count: number; product_count: number; last_order_at: string | null;
  whatsapp_commercial: string; email_commercial: string;
};

const STATUS_COLOR: Record<string, string> = {
  active:          "bg-green-100 text-green-700",
  trial:           "bg-amber-100 text-amber-700",
  suspended:       "bg-red-100 text-red-700",
  cancelled:       "bg-slate-100 text-slate-500",
  pending_payment: "bg-orange-100 text-orange-700",
};

const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro", business: "Business", enterprise: "Enterprise" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function AdminDistribuidorasPage() {
  const token = useApiToken();
  const [list, setList] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan,   setFilterPlan]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCity,   setFilterCity]   = useState("");
  const [approvingId,  setApprovingId]  = useState<string | null>(null);

  function load() {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPlan)   params.set("plan",   filterPlan);
    if (filterStatus) params.set("status", filterStatus);
    if (filterCity)   params.set("city",   filterCity);
    apiFetch(`/api/admin/distribuidoras?${params}`, { method: "GET", token })
      .then(async (r) => { if (r.ok) { const d = await r.json() as { distributors: Distributor[] }; setList(d.distributors); } })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]);

  async function approve(id: string) {
    if (!token) return;
    setApprovingId(id);
    const res = await apiFetch(`/api/admin/distributors/${id}/approve`, {
      method: "PATCH", token, body: JSON.stringify({ approved: true }),
    });
    if (res.ok) setList((prev) => prev.map((d) => d.id === id ? { ...d, approved_by_admin: true } : d));
    setApprovingId(null);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Distribuidoras</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">{list.length} distribuidoras cadastradas</p>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none">
          <option value="">Todos os planos</option>
          {["starter","pro","business","enterprise"].map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none">
          <option value="">Todos os status</option>
          {["active","trial","suspended","cancelled","pending_payment"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={filterCity} onChange={(e) => setFilterCity(e.target.value)}
          placeholder="Filtrar por cidade…"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none" />
        <button onClick={load}
          className="rounded-xl bg-[#22C55E] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A34A]">
          Filtrar
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {["Empresa", "Plano", "Status", "Cidade", "Pedidos", "Produtos", "Cadastro", "Últ. pedido", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#0F172A]">{d.company_name}</p>
                    <p className="text-[11px] font-medium text-slate-400">{d.cnpj}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{PLAN_LABEL[d.plan] ?? d.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLOR[d.plan_status] ?? "bg-slate-100 text-slate-500"}`}>
                      {d.plan_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600">{d.delivery_city} / {d.delivery_state}</td>
                  <td className="px-4 py-3 font-bold text-[#0F172A]">{d.order_count}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{d.product_count}</td>
                  <td className="px-4 py-3 font-medium text-slate-500">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-500">{formatDate(d.last_order_at)}</td>
                  <td className="px-4 py-3">
                    {!d.approved_by_admin && (
                      <button
                        onClick={() => approve(d.id)}
                        disabled={approvingId === d.id}
                        className="rounded-lg bg-[#22C55E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#16A34A] disabled:opacity-50">
                        {approvingId === d.id ? "…" : "Aprovar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <p className="py-10 text-center text-sm font-medium text-slate-400">Nenhuma distribuidora encontrada.</p>
          )}
        </div>
      )}
    </main>
  );
}
