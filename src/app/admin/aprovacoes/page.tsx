"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type Pending = {
  id: string; company_name: string; cnpj: string;
  plan: string; plan_status: string; plan_period: string;
  responsible_name: string; whatsapp_commercial: string; email_commercial: string;
  created_at: string; approved_by_admin: boolean;
  _count: { products: number; delivery_regions: number };
};

const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro", business: "Business", enterprise: "Enterprise" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminAprovacoesPage() {
  const token = useApiToken();
  const [list, setList] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showReject, setShowReject] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/distributors?approved=false", { method: "GET", token })
      .then(async (r) => { if (r.ok) { const d = await r.json() as { data: Pending[] }; setList(d.data ?? []); } })
      .finally(() => setLoading(false));
  }, [token]);

  async function approve(id: string) {
    if (!token) return;
    setActing(id);
    const res = await apiFetch(`/api/admin/distributors/${id}/approve`, {
      method: "PATCH", token, body: JSON.stringify({ approved: true }),
    });
    if (res.ok) setList((prev) => prev.filter((d) => d.id !== id));
    setActing(null);
  }

  async function reject(id: string) {
    if (!token) return;
    setActing(id);
    // For now, just mark as cancelled via a reject route (reuse approve with approved: false and then update status)
    await apiFetch(`/api/admin/distributors/${id}/approve`, {
      method: "PATCH", token, body: JSON.stringify({ approved: false }),
    });
    setList((prev) => prev.filter((d) => d.id !== id));
    setShowReject(null);
    setActing(null);
  }

  const pending = list.filter((d) => !d.approved_by_admin);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Aprovações pendentes</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">{pending.length} distribuidora{pending.length !== 1 ? "s" : ""} aguardando revisão</p>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <svg className="mx-auto mb-3 h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-base font-semibold text-[#0F172A]">Tudo em dia!</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Nenhuma distribuidora aguardando aprovação.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((d) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#0F172A]">{d.company_name}</p>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      {PLAN_LABEL[d.plan] ?? d.plan}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">CNPJ {d.cnpj}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-medium text-slate-600 sm:grid-cols-4">
                    <span>Responsável: <strong className="text-[#0F172A]">{d.responsible_name}</strong></span>
                    <span>Produtos: <strong className="text-[#0F172A]">{d._count.products}</strong></span>
                    <span>Regiões: <strong className="text-[#0F172A]">{d._count.delivery_regions}</strong></span>
                    <span>Cadastro: <strong className="text-[#0F172A]">{formatDate(d.created_at)}</strong></span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {d.email_commercial} · {d.whatsapp_commercial}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => approve(d.id)} disabled={acting === d.id}
                    className="rounded-xl bg-[#22C55E] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A34A] disabled:opacity-50">
                    {acting === d.id ? "…" : "Aprovar"}
                  </button>
                  <button onClick={() => setShowReject(showReject === d.id ? null : d.id)} disabled={acting === d.id}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">
                    Recusar
                  </button>
                </div>
              </div>

              {showReject === d.id && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                  <label className="mb-2 block text-xs font-bold text-red-800">Motivo da recusa (opcional)</label>
                  <textarea rows={2} value={rejectReason[d.id] ?? ""}
                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none" />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => reject(d.id)} disabled={acting === d.id}
                      className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                      Confirmar recusa
                    </button>
                    <button onClick={() => setShowReject(null)} className="text-sm font-medium text-slate-500 hover:text-slate-700">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
