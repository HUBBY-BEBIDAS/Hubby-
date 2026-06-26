"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type CredentialClient = {
  id: string;
  company_name: string;
  cnpj: string;
  establishment_type: string;
  responsible_name: string;
  whatsapp: string;
  delivery_city: string;
  delivery_state: string;
  hubby_score: number;
  hubby_status: string;
};

type Credential = {
  id: string;
  status: string;
  credit_score: number | null;
  review_note: string | null;
  payment_note: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
  client: CredentialClient;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  approved: "Aprovado",
  rejected_auto: "Reprovado automaticamente",
  rejected_manual: "Reprovado",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-[#22C55E]/15 text-[#16A34A]",
  rejected_auto: "bg-red-100 text-red-700",
  rejected_manual: "bg-red-100 text-red-700",
};

const ESTABLISHMENT_LABEL: Record<string, string> = {
  bar: "Bar",
  restaurant: "Restaurante",
  adega: "Adega",
  hotel: "Hotel",
  nightclub: "Casa Noturna",
  supermarket: "Supermercado",
  convenience: "Conveniência",
  other: "Outro",
};

function formatCnpj(raw: string) {
  const d = raw.replace(/\D/g, "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function hubbyScoreLabel(score: number): string {
  if (score >= 600) return "Histórico excelente";
  if (score >= 400) return "Histórico regular";
  return "Histórico com ocorrências";
}

function hubbyScoreColor(score: number): string {
  if (score >= 600) return "text-[#16A34A]";
  if (score >= 400) return "text-amber-700";
  return "text-red-700";
}

function HubbyBadge({ score, status }: { score: number; status: string }) {
  const isWarn = status === "approved_with_warning";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isWarn ? "bg-amber-100 text-amber-800" : "bg-[#22C55E]/15 text-[#16A34A]"}`}>
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L2 4v4c0 3.31 2.55 5.91 6 6.5 3.45-.59 6-3.19 6-6.5V4L8 1.5Z" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {isWarn ? "Aprovado com aviso" : "Aprovado pela Hubby"}
      </span>
      <span className={`text-xs font-bold ${hubbyScoreColor(score)}`}>
        Score {score} — {hubbyScoreLabel(score)}
      </span>
    </div>
  );
}

export default function CredenciaisPage() {
  const token = useApiToken();
  const router = useRouter();

  const [tab, setTab] = useState<"pending" | "approved" | "all">("pending");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  const [actingId, setActingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Approval form state per credential
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showReject, setShowReject] = useState<string | null>(null);

  // Payment note (anotação interna de prazo combinado)
  const [paymentNoteEdit, setPaymentNoteEdit] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const [clientProfile, setClientProfile] = useState<Record<string, { payment_history: { on_time: number; late: number; not_paid: number }; total_orders: number; months_on_platform: number }>>({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const status = tab === "all" ? "all" : tab;
    apiFetch(`/api/distributor/credentials?status=${status}&limit=50`, { method: "GET", token })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json() as { data: Credential[] };
          setCredentials(data.data ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [token, tab]);

  async function loadProfile(clientId: string) {
    if (!token || clientProfile[clientId]) return;
    const r = await apiFetch(`/api/clients/${clientId}/profile`, { method: "GET", token });
    if (r.ok) {
      const p = await r.json();
      setClientProfile((prev) => ({ ...prev, [clientId]: p }));
    }
  }

  async function decide(credentialId: string, decision: "approved" | "rejected") {
    if (!token) return;
    setActingId(credentialId);
    const body: Record<string, string> = { decision };
    const noteVal = decision === "approved" ? notes[credentialId] : rejectNote[credentialId];
    if (noteVal) body.note = noteVal;

    const res = await apiFetch(`/api/distributor/credentials/${credentialId}/decide`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setCredentials((prev) => prev.filter((c) => c.id !== credentialId));
      setShowReject(null);
      setExpandedId(null);
    } else {
      const err = await res.json().catch(() => ({}));
      alert((err as { error?: string }).error ?? "Erro ao processar decisão.");
    }
    setActingId(null);
  }

  async function savePaymentNote(credentialId: string) {
    if (!token) return;
    setSavingNote(credentialId);
    const note = paymentNoteEdit[credentialId] ?? "";
    const res = await apiFetch(`/api/distributor/credentials/${credentialId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ payment_note: note.trim() || null }),
    });
    if (res.ok) {
      setCredentials((prev) => prev.map((c) =>
        c.id === credentialId ? { ...c, payment_note: note.trim() || null } : c
      ));
    }
    setSavingNote(null);
  }

  const tabs: Array<{ key: typeof tab; label: string }> = [
    { key: "pending", label: "Aguardando" },
    { key: "approved", label: "Aprovados" },
    { key: "all", label: "Todos" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <button onClick={() => router.back()} className="mb-4 text-sm font-medium text-slate-500 hover:text-[#0F172A]">
        ← Voltar
      </button>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Credenciamentos</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">Compradores que solicitaram acesso ao seu catálogo</p>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-all",
              tab === t.key ? "bg-[#22C55E] text-white shadow-sm" : "text-slate-600 hover:text-[#0F172A]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <p className="text-base font-semibold text-[#0F172A]">Nenhum credenciamento {tab === "pending" ? "pendente" : "encontrado"}.</p>
          <p className="mt-1 text-sm text-slate-500">Quando um comprador solicitar acesso, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred) => {
            const isExpanded = expandedId === cred.id;
            const profile = clientProfile[cred.client.id];
            return (
              <div key={cred.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <button
                  onClick={() => {
                    const next = isExpanded ? null : cred.id;
                    setExpandedId(next);
                    if (next) loadProfile(cred.client.id);
                  }}
                  className="w-full px-6 py-5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[#0F172A]">{cred.client.company_name}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLOR[cred.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABEL[cred.status] ?? cred.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {ESTABLISHMENT_LABEL[cred.client.establishment_type] ?? cred.client.establishment_type} · {cred.client.delivery_city}/{cred.client.delivery_state} · Solicitado em {formatDate(cred.created_at)}
                      </p>
                      <div className="mt-2">
                        <HubbyBadge score={cred.client.hubby_score} status={cred.client.hubby_status} />
                      </div>
                    </div>
                    <svg className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 pb-6 pt-4">
                    {/* Client info */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-medium text-slate-600 sm:grid-cols-4">
                      <span>CNPJ: <strong className="text-[#0F172A]">{formatCnpj(cred.client.cnpj)}</strong></span>
                      <span>Responsável: <strong className="text-[#0F172A]">{cred.client.responsible_name}</strong></span>
                      <span>WhatsApp: <strong className="text-[#0F172A]">{cred.client.whatsapp}</strong></span>
                      {cred.credit_score !== null && (
                        <span>Score bureau: <strong className="text-[#0F172A]">{cred.credit_score}</strong></span>
                      )}
                    </div>

                    {/* Hubby profile stats */}
                    {profile && (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pedidos</p>
                          <p className="mt-1 text-xl font-extrabold text-[#0F172A]">{profile.total_orders}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Na plataforma</p>
                          <p className="mt-1 text-xl font-extrabold text-[#0F172A]">{profile.months_on_platform}m</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Em dia</p>
                          <p className="mt-1 text-xl font-extrabold text-[#16A34A]">{profile.payment_history.on_time}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Atraso/Não pagou</p>
                          <p className={`mt-1 text-xl font-extrabold ${profile.payment_history.late + profile.payment_history.not_paid > 0 ? "text-red-600" : "text-slate-400"}`}>
                            {profile.payment_history.late + profile.payment_history.not_paid}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Approval (only for pending) */}
                    {cred.status === "pending" && (
                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Nota interna (opcional)</label>
                          <textarea
                            rows={2}
                            value={notes[cred.id] ?? ""}
                            onChange={(e) => setNotes((p) => ({ ...p, [cred.id]: e.target.value }))}
                            placeholder="Ex: cliente com limite de R$ 5.000 por pedido"
                            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            disabled={actingId === cred.id}
                            onClick={() => decide(cred.id, "approved")}
                            className="rounded-xl bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#16A34A] disabled:opacity-50"
                          >
                            {actingId === cred.id ? "Processando…" : "Aprovar credenciamento"}
                          </button>
                          <button
                            disabled={actingId === cred.id}
                            onClick={() => setShowReject(showReject === cred.id ? null : cred.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </div>

                        {showReject === cred.id && (
                          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                            <label className="mb-1.5 block text-xs font-bold text-red-800">Motivo da recusa (opcional)</label>
                            <textarea
                              rows={2}
                              value={rejectNote[cred.id] ?? ""}
                              onChange={(e) => setRejectNote((p) => ({ ...p, [cred.id]: e.target.value }))}
                              className="w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-[#0F172A] outline-none"
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                disabled={actingId === cred.id}
                                onClick={() => decide(cred.id, "rejected")}
                                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirmar recusa
                              </button>
                              <button onClick={() => setShowReject(null)} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Approved: details + payment note */}
                    {cred.status === "approved" && (
                      <>
                        <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                          {cred.approved_at && (
                            <span>Aprovado em: <strong className="text-[#0F172A]">{formatDate(cred.approved_at)}</strong></span>
                          )}
                          {cred.expires_at && (
                            <span>Expira em: <strong className="text-[#0F172A]">{formatDate(cred.expires_at)}</strong></span>
                          )}
                          {cred.review_note && (
                            <span className="w-full">Nota de aprovação: <strong className="text-[#0F172A]">{cred.review_note}</strong></span>
                          )}
                        </div>

                        {/* Anotação interna de prazo — editável */}
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Anotação interna — prazo combinado
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={200}
                              placeholder="Ex: 28 dias — cliente antigo de confiança"
                              value={paymentNoteEdit[cred.id] ?? (cred.payment_note ?? "")}
                              onChange={(e) => setPaymentNoteEdit((p) => ({ ...p, [cred.id]: e.target.value }))}
                              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                            />
                            <button
                              disabled={savingNote === cred.id}
                              onClick={() => savePaymentNote(cred.id)}
                              className="rounded-xl bg-[#0F172A] px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              {savingNote === cred.id ? "…" : "Salvar"}
                            </button>
                          </div>
                          <p className="mt-1 text-[10px] font-medium text-slate-400">
                            Visível apenas para você — o comprador não vê esta anotação.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
