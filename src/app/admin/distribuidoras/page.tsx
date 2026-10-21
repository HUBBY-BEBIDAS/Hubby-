"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ONBOARDING_STATUS_CONFIG, type OnboardingStatus } from "@/config/plans";
import { ChevronDown, Upload, RefreshCw, CheckCircle2 } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Distributor = {
  id: string;
  company_name: string;
  cnpj: string;
  plan: string;
  plan_status: string;
  plan_period: string;
  approved_by_admin: boolean;
  onboarding_status: OnboardingStatus;
  created_at: string;
  delivery_city: string;
  delivery_state: string;
  order_count: number;
  product_count: number;
  last_order_at: string | null;
  whatsapp_commercial: string;
  email_commercial: string;
};

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:          "bg-green-100 text-green-700",
  trial:           "bg-amber-100 text-amber-700",
  suspended:       "bg-red-100 text-red-700",
  cancelled:       "bg-slate-100 text-slate-500",
  pending_payment: "bg-orange-100 text-orange-700",
};

const PLAN_LABEL: Record<string, string> = {
  starter:    "Starter",
  pro:        "Pro",
  enterprise: "Enterprise",
};

const ONBOARDING_OPTIONS: OnboardingStatus[] = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO"];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Sub-componente: Badge de Onboarding ─────────────────────────────────────

function OnboardingBadge({ status }: { status: OnboardingStatus }) {
  const cfg = ONBOARDING_STATUS_CONFIG[status] ?? ONBOARDING_STATUS_CONFIG.PENDENTE;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

// ─── Sub-componente: Selector de Onboarding Status ───────────────────────────

function OnboardingStatusSelector({
  distributorId,
  currentStatus,
  token,
  onUpdated,
}: {
  distributorId: string;
  currentStatus: OnboardingStatus;
  token: string | null;
  onUpdated: (id: string, status: OnboardingStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  async function changeStatus(newStatus: OnboardingStatus) {
    if (!token || newStatus === currentStatus) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    const res = await apiFetch(`/api/admin/distributors/${distributorId}/onboarding`, {
      method: "PATCH",
      token,
      body:   JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      onUpdated(distributorId, newStatus);
    }
    setLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
      >
        <OnboardingBadge status={currentStatus} />
        {loading ? <RefreshCw size={11} className="animate-spin text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 min-w-[170px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
            {ONBOARDING_OPTIONS.map((s) => {
              const cfg = ONBOARDING_STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-slate-50 transition ${s === currentStatus ? "font-bold" : "font-medium"}`}
                >
                  {s === currentStatus && <CheckCircle2 size={13} className="text-[#22C55E] shrink-0" />}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badgeClass}`}>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-componente: Modal de Importação de Catálogo pelo Admin ───────────────

function CatalogImportModal({
  distributor,
  token,
  onClose,
}: {
  distributor: Distributor;
  token: string | null;
  onClose: () => void;
}) {
  const [reason,  setReason]  = useState(`Onboarding assistido Pro — importação inicial do catálogo`);
  const [json,    setJson]    = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; message: string } | null>(null);

  async function submit() {
    if (!token) return;
    let products: unknown;
    try {
      products = JSON.parse(json);
    } catch {
      setResult({ ok: false, message: "JSON inválido. Verifique o formato." });
      return;
    }
    if (!Array.isArray(products) || products.length === 0) {
      setResult({ ok: false, message: "O JSON precisa ser um array de produtos com pelo menos 1 item." });
      return;
    }
    setLoading(true);
    const res = await apiFetch(`/api/admin/distributors/${distributor.id}/catalog-import`, {
      method: "POST",
      token,
      body:   JSON.stringify({ products, reason }),
    });
    const data = await res.json() as { message?: string; error?: string };
    setResult({ ok: res.ok, message: data.message ?? data.error ?? "Erro desconhecido" });
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Importar catálogo em nome da distribuidora
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              {distributor.company_name} · Plano <span className="font-bold text-[#0F172A]">{PLAN_LABEL[distributor.plan] ?? distributor.plan}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Motivo */}
          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-slate-500">
              Motivo / Descrição do log
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/40"
            />
          </div>

          {/* JSON de produtos */}
          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-slate-500">
              Produtos (JSON Array)
            </label>
            <p className="mb-2 text-[11px] text-slate-400 leading-relaxed">
              Cole um array JSON com os campos: <code className="font-mono">name</code>, <code className="font-mono">brand</code>, <code className="font-mono">category</code>, <code className="font-mono">packaging_type</code>, <code className="font-mono">packaging_volume_ml</code>, <code className="font-mono">price_cents</code>, <code className="font-mono">available</code>.
            </p>
            <textarea
              rows={10}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={`[\n  {\n    "name": "Cerveja X",\n    "brand": "Marca Y",\n    "category": "cerveja",\n    "packaging_type": "lata",\n    "packaging_volume_ml": 350,\n    "price_cents": 499,\n    "available": true\n  }\n]`}
              className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/40"
            />
          </div>

          {/* Resultado */}
          {result && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !json.trim()}
            className="flex items-center gap-2 rounded-xl bg-[#22C55E] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#16A34A] disabled:opacity-50 transition"
          >
            {loading ? (
              <><RefreshCw size={14} className="animate-spin" /> Importando…</>
            ) : (
              <><Upload size={14} /> Importar catálogo</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function AdminDistribuidorasPage() {
  const token                 = useApiToken();
  const [list,        setList]        = useState<Distributor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterPlan,  setFilterPlan]  = useState("");
  const [filterStatus,setFilterStatus]= useState("");
  const [filterCity,  setFilterCity]  = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<Distributor | null>(null);

  const [apiError, setApiError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setLoading(true);
    setApiError(null);
    const params = new URLSearchParams();
    if (filterPlan)    params.set("plan",   filterPlan);
    if (filterStatus)  params.set("status", filterStatus);
    if (filterCity)    params.set("city",   filterCity);
    apiFetch(`/api/admin/distribuidoras?${params}`, { method: "GET", token: token as string })
      .then(async (r) => {
        const data = await r.json() as { distributors?: Distributor[]; error?: string };
        if (r.ok && data.distributors) {
          setList(data.distributors);
        } else {
          console.error("[AdminDistribuidoras] Erro na API:", r.status, data);
          setApiError(data.error ?? `Erro ${r.status} ao carregar distribuidoras. Veja o console.`);
        }
      })
      .catch((err) => {
        console.error("[AdminDistribuidoras] Falha de rede:", err);
        setApiError("Falha de rede ao carregar distribuidoras.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps


  async function approve(id: string) {
    if (!token) return;
    setApprovingId(id);
    const res = await apiFetch(`/api/admin/distributors/${id}/approve`, {
      method: "PATCH", token, body: JSON.stringify({ approved: true }),
    });
    if (res.ok) {
      setList((prev) => prev.map((d) => d.id === id ? { ...d, approved_by_admin: true } : d));
    }
    setApprovingId(null);
  }

  function handleOnboardingUpdated(id: string, status: OnboardingStatus) {
    setList((prev) => prev.map((d) => d.id === id ? { ...d, onboarding_status: status } : d));
  }

  const HEADERS = [
    "Empresa", "Plano", "Onboarding Pro", "Status", "Cidade",
    "Pedidos", "Produtos", "Cadastro", "Últ. pedido", "Ações",
  ];

  return (
    <>
      <main className="mx-auto max-w-[1400px] px-4 py-8">
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Distribuidoras</h1>
        <p className="mb-6 text-sm font-medium text-slate-500">{list.length} distribuidoras cadastradas</p>

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none"
          >
            <option value="">Todos os planos</option>
            {["starter", "pro", "enterprise"].map((p) => (
              <option key={p} value={p}>{PLAN_LABEL[p]}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none"
          >
            <option value="">Todos os status</option>
            {["active", "trial", "suspended", "cancelled", "pending_payment"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            placeholder="Filtrar por cidade…"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0F172A] focus:outline-none"
          />

          <button
            onClick={load}
            className="rounded-xl bg-[#22C55E] px-4 py-2 text-sm font-bold text-white hover:bg-[#16A34A] transition"
          >
            Filtrar
          </button>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {HEADERS.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    {/* Empresa */}
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#0F172A]">{d.company_name}</p>
                      <p className="text-[11px] font-medium text-slate-400">{d.cnpj}</p>
                    </td>

                    {/* Plano */}
                    <td className="px-4 py-3 font-semibold text-[#0F172A]">
                      {PLAN_LABEL[d.plan] ?? d.plan}
                    </td>

                    {/* Onboarding Pro */}
                    <td className="px-4 py-3">
                      {d.plan === "pro" || d.plan === "enterprise" ? (
                        <OnboardingStatusSelector
                          distributorId={d.id}
                          currentStatus={d.onboarding_status}
                          token={token}
                          onUpdated={handleOnboardingUpdated}
                        />
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status do plano */}
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLOR[d.plan_status] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        {d.plan_status}
                      </span>
                    </td>

                    {/* Cidade */}
                    <td className="px-4 py-3 font-medium text-slate-600">
                      {d.delivery_city} / {d.delivery_state}
                    </td>

                    {/* Pedidos */}
                    <td className="px-4 py-3 font-bold text-[#0F172A]">{d.order_count}</td>

                    {/* Produtos */}
                    <td className="px-4 py-3 font-medium text-slate-600">{d.product_count}</td>

                    {/* Cadastro */}
                    <td className="px-4 py-3 font-medium text-slate-500">{formatDate(d.created_at)}</td>

                    {/* Último pedido */}
                    <td className="px-4 py-3 font-medium text-slate-500">{formatDate(d.last_order_at)}</td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Aprovar */}
                        {!d.approved_by_admin && (
                          <button
                            onClick={() => approve(d.id)}
                            disabled={approvingId === d.id}
                            className="rounded-lg bg-[#22C55E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#16A34A] disabled:opacity-50 transition"
                          >
                            {approvingId === d.id ? "…" : "Aprovar"}
                          </button>
                        )}

                        {/* Importar catálogo (apenas Pro / Enterprise) */}
                        {(d.plan === "pro" || d.plan === "enterprise") && (
                          <button
                            onClick={() => setImportTarget(d)}
                            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                          >
                            <Upload size={11} />
                            Catálogo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {list.length === 0 && (
              <p className="py-10 text-center text-sm font-medium text-slate-400">
                Nenhuma distribuidora encontrada.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Modal de importação de catálogo */}
      {importTarget && (
        <CatalogImportModal
          distributor={importTarget}
          token={token}
          onClose={() => setImportTarget(null)}
        />
      )}
    </>
  );
}
