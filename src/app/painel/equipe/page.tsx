"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  Users, Lock, Plus, Trash2, TrendingUp, Target,
  CheckCircle, AlertTriangle, XCircle, Mail,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TeamMember = {
  id: string;
  invited_email: string;
  role_label: "vendedor" | "supervisor" | "atendimento";
  role_scope: "all_clients" | "assigned_clients";
  assigned_client_ids: string[];
  sales_target_monthly_cents: number | null;
  status: "pending" | "active" | "inactive";
  orders_this_month: number;
  value_this_month_cents: number;
  target_pct: number | null;
  performance_badge: "acima_meta" | "em_dia" | "abaixo_meta" | "sem_meta";
  user: { id: string; email: string } | null;
};

type CollaboratorDashboard = {
  membership: {
    id: string;
    role_label: string;
    sales_target_monthly_cents: number | null;
    distributor: { company_name: string };
  };
  orders_this_month: number;
  value_this_month_cents: number;
  target_pct: number | null;
  recent_orders: {
    id: string; total_cents: number; status: string; sent_at: string;
    client: { company_name: string; delivery_city: string };
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function BadgePerformance({ badge, pct }: { badge: string; pct: number | null }) {
  if (badge === "acima_meta") return (
    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
      <CheckCircle size={11} />Acima da meta {pct !== null && `(${pct}%)`}
    </span>
  );
  if (badge === "em_dia") return (
    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
      <TrendingUp size={11} />Em dia {pct !== null && `(${pct}%)`}
    </span>
  );
  if (badge === "abaixo_meta") return (
    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
      <XCircle size={11} />Abaixo da meta {pct !== null && `(${pct}%)`}
    </span>
  );
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">Sem meta</span>
  );
}

const ROLE_LABELS = { vendedor: "Vendedor", supervisor: "Supervisor", atendimento: "Atendimento" };

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EquipePage() {
  const { data: session } = useSession({ required: true });
  const token = useApiToken();
  const role  = (session?.user as { role?: string })?.role ?? "";
  const isAdmin = role === "distributor_admin";

  const [loading,      setLoading]      = useState(true);
  const [planAllows,   setPlanAllows]   = useState(true);
  const [members,      setMembers]      = useState<TeamMember[]>([]);
  const [dashboard,    setDashboard]    = useState<CollaboratorDashboard | null>(null);
  const [showInvite,   setShowInvite]   = useState(false);
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteRole,   setInviteRole]   = useState<"vendedor" | "supervisor" | "atendimento">("vendedor");
  const [targetInput,  setTargetInput]  = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/distributor/team", { method: "GET", token })
      .then(async (res) => {
        const data = await res.json();
        if (isAdmin) {
          setPlanAllows(data.plan_allows_team ?? true);
          setMembers(data.members ?? []);
        } else {
          setDashboard(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  async function handleInvite() {
    if (!token || !inviteEmail) return;
    setInviteSaving(true);
    try {
      const res = await apiFetch("/api/distributor/team", {
        method: "POST",
        token,
        body: JSON.stringify({
          invited_email:              inviteEmail,
          role_label:                 inviteRole,
          sales_target_monthly_cents: targetInput ? Math.round(parseFloat(targetInput.replace(",", ".")) * 100) : null,
        }),
      });
      const data = await res.json() as { member: TeamMember };
      if (res.ok) {
        setMembers((prev) => [...prev, { ...data.member, orders_this_month: 0, value_this_month_cents: 0, target_pct: null, performance_badge: "sem_meta" }]);
        setShowInvite(false);
        setInviteEmail("");
        setTargetInput("");
      }
    } catch { /* silencia */ }
    finally { setInviteSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/distributor/team/${id}`, { method: "DELETE", token });
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch { /* silencia */ }
    finally { setDeletingId(null); }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl px-4 py-10">
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />)}</div>
        </main>
      </div>
    );
  }

  // ── Gate de plano ──────────────────────────────────────────────────────────
  if (isAdmin && !planAllows) {
    return (
      <div className="min-h-screen bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl px-4 py-16">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-[#DBEAFE] bg-white px-8 py-14 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F7FB]">
              <Lock size={28} className="text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A]">Gestão de equipe comercial</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Convide colaboradores, defina carteiras de clientes e acompanhe o desempenho individual da sua equipe.
              </p>
            </div>
            <ul className="mt-2 space-y-2.5 text-left text-sm text-slate-600">
              {[
                "Convite por e-mail com acesso controlado por carteira",
                "Metas mensais individuais com acompanhamento em tempo real",
                "Relatório mensal de desempenho enviado por e-mail",
                "Ranking de colaboradores por volume e valor de pedidos",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-[#22C55E]" />{f}
                </li>
              ))}
            </ul>
            <a
              href={session ? "/meu-plano" : "/planos"}
              className="mt-2 rounded-xl bg-[#0F172A] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#1E293B]"
            >
              Conhecer o plano Pro →
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ── Dashboard do colaborador ───────────────────────────────────────────────
  if (!isAdmin && dashboard) {
    const { membership, orders_this_month, value_this_month_cents, target_pct, recent_orders } = dashboard;
    return (
      <div className="min-h-screen bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#0F172A]">Meu desempenho</h1>
            <p className="mt-1 text-sm text-slate-500">{membership.distributor.company_name} · {ROLE_LABELS[membership.role_label as keyof typeof ROLE_LABELS] ?? membership.role_label}</p>
          </div>

          {/* Métricas do mês */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#DBEAFE] bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-black text-[#0F172A]">{orders_this_month}</p>
              <p className="mt-0.5 text-xs text-slate-500">pedidos este mês</p>
            </div>
            <div className="rounded-2xl border border-[#DBEAFE] bg-white p-4 text-center shadow-sm">
              <p className="text-lg font-black text-[#0F172A]">{formatBRL(value_this_month_cents)}</p>
              <p className="mt-0.5 text-xs text-slate-500">valor total</p>
            </div>
            <div className={`rounded-2xl border p-4 text-center shadow-sm ${target_pct !== null && target_pct >= 100 ? "border-green-200 bg-green-50" : target_pct !== null && target_pct < 80 ? "border-red-200 bg-red-50" : "border-[#DBEAFE] bg-white"}`}>
              <p className={`text-2xl font-black ${target_pct !== null && target_pct >= 100 ? "text-green-700" : target_pct !== null && target_pct < 80 ? "text-red-700" : "text-[#0F172A]"}`}>
                {target_pct !== null ? `${target_pct}%` : "–"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">da meta mensal</p>
              {membership.sales_target_monthly_cents && (
                <p className="text-[10px] text-slate-400">Meta: {formatBRL(membership.sales_target_monthly_cents)}</p>
              )}
            </div>
          </div>

          {/* Pedidos recentes */}
          <div className="rounded-2xl border border-[#DBEAFE] bg-white shadow-sm">
            <div className="border-b border-[#DBEAFE] px-5 py-3">
              <p className="text-sm font-bold text-[#0F172A]">Pedidos recentes</p>
            </div>
            {recent_orders.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">Nenhum pedido este mês</p>
            ) : (
              <ul className="divide-y divide-[#DBEAFE]">
                {recent_orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[#0F172A]">{o.client.company_name}</p>
                      <p className="text-xs text-slate-400">{o.client.delivery_city}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#0F172A]">{formatBRL(o.total_cents)}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${o.status === "approved" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {o.status === "sent" ? "enviado" : o.status === "approved" ? "aprovado" : o.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── Visão do admin ─────────────────────────────────────────────────────────

  const totalValueCents = members.reduce((s, m) => s + m.value_this_month_cents, 0);

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0F172A]">
              <Users size={22} className="text-[#2563EB]" />Equipe comercial
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {members.length} membro{members.length !== 1 ? "s" : ""} · {formatBRL(totalValueCents)} em pedidos este mês
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
          >
            <Plus size={15} />Adicionar colaborador
          </button>
        </div>

        {/* Formulário de convite */}
        {showInvite && (
          <div className="mb-6 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[#0F172A]">Convidar colaborador</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">E-mail</label>
                <input
                  type="email"
                  placeholder="colaborador@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Função</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="atendimento">Atendimento</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Meta mensal (R$) — opcional</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 50000"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleInvite}
                disabled={inviteSaving || !inviteEmail}
                className="flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E293B] disabled:opacity-60"
              >
                <Mail size={14} />{inviteSaving ? "Enviando…" : "Enviar convite"}
              </button>
              <button onClick={() => setShowInvite(false)} className="text-sm text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista de membros */}
        {members.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-14 text-center">
            <Users size={32} className="mx-auto text-slate-200" />
            <p className="mt-3 font-semibold text-slate-700">Nenhum colaborador ainda</p>
            <p className="mt-1 text-sm text-slate-400">Convide sua equipe para gerenciar pedidos e carteiras de clientes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] text-sm font-black">
                      {m.invited_email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{m.invited_email}</p>
                      <p className="text-xs text-slate-400">{ROLE_LABELS[m.role_label as keyof typeof ROLE_LABELS] ?? m.role_label}</p>
                      {m.status === "pending" && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <AlertTriangle size={9} />Convite pendente
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <BadgePerformance badge={m.performance_badge} pct={m.target_pct} />
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Métricas */}
                <div className="mt-4 flex flex-wrap gap-5 border-t border-[#DBEAFE] pt-4">
                  <div className="text-xs text-slate-500">
                    Pedidos este mês: <strong className="text-[#0F172A]">{m.orders_this_month}</strong>
                  </div>
                  <div className="text-xs text-slate-500">
                    Valor: <strong className="text-[#0F172A]">{formatBRL(m.value_this_month_cents)}</strong>
                  </div>
                  {m.sales_target_monthly_cents && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Target size={12} className="text-[#2563EB]" />
                      Meta: <strong className="text-[#0F172A]">{formatBRL(m.sales_target_monthly_cents)}</strong>
                    </div>
                  )}
                  {m.assigned_client_ids.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Carteira: <strong className="text-[#0F172A]">{m.assigned_client_ids.length} cliente{m.assigned_client_ids.length !== 1 ? "s" : ""}</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
