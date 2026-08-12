"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CityAutocomplete, type CityOption } from "@/components/ui/CityAutocomplete";
import { StateSelect } from "@/components/ui/StateSelect";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Check, Plus, Trash2, MapPin, Gift, Copy, Star } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DeliveryAddress = {
  id: string;
  label: string;
  zip_code: string;
  city: string;
  state: string;
  address_full: string;
  is_default: boolean;
};

type ClientProfile = {
  id: string;
  company_name: string;
  cnpj: string;
  establishment_type: string;
  responsible_name: string;
  whatsapp: string;
  invoice_email?: string | null;
  delivery_city: string;
  delivery_state: string;
  delivery_address_full: string;
  delivery_zip_code: string | null;
  max_delivery_days_default: number | null;
  client_plan: string;
  delivery_addresses: DeliveryAddress[];
};

type CepResult = {
  zip_code: string;
  city: string;
  state: string;
  street: string;
  district: string;
};

type ReferralData = {
  referral_code: string;
  referral_link: string;
  is_ambassador: boolean;
  total_sent: number;
  total_converted: number;
  total_days_earned: number;
  next_milestone: number | null;
  next_reward_days: number;
  referrals: { id: string; distributor_name: string; status: string; reward_days: number | null; created_at: string; converted_at: string | null }[];
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTABLISHMENT_TYPES = [
  { value: "bar",         label: "Bar" },
  { value: "restaurant",  label: "Restaurante" },
  { value: "adega",       label: "Adega" },
  { value: "hotel",       label: "Hotel" },
  { value: "nightclub",   label: "Casa Noturna" },
  { value: "supermarket", label: "Supermercado" },
  { value: "convenience", label: "Conveniência" },
  { value: "other",       label: "Outro" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatWhatsapp(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatZip(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PerfilClientePage() {
  const { data: session, status, update: updateSession } = useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const role = (session?.user as { role?: string })?.role ?? "";

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");

  // Campos do formulário principal
  const [form, setForm] = useState({
    company_name:          "",
    cnpj:                  "",
    establishment_type:    "bar",
    responsible_name:      "",
    whatsapp:              "",
    invoice_email:         "",
    delivery_zip_code:     "",
    delivery_city:         "",
    delivery_state:        "",
    delivery_address_full: "",
    max_delivery_days_default: "" as string | number,
    pref_email_monthly_report: true,
    pref_email_price_alerts:   true,
    client_plan:           "",
  });

  // CEP lookup para o campo principal
  const [cepLoading, setCepLoading]   = useState(false);
  const [cepResult,  setCepResult]    = useState<CepResult | null>(null);
  const [cepError,   setCepError]     = useState("");

  // Multi-endereços (Pro)
  const [proAddresses, setProAddresses] = useState<DeliveryAddress[]>([]);
  const [addAddrForm, setAddAddrForm]   = useState<{
    label: string; zip: string; city: string; state: string; address_full: string;
  } | null>(null);
  const [addAddrCepResult, setAddAddrCepResult] = useState<CepResult | null>(null);
  const [addAddrCepLoading, setAddAddrCepLoading] = useState(false);
  const [addAddrCepError,   setAddAddrCepError]   = useState("");
  const [addAddrSaving,     setAddAddrSaving]     = useState(false);
  const [deletingId,        setDeletingId]         = useState<string | null>(null);
  const [referralData,      setReferralData]        = useState<ReferralData | null>(null);
  const [copySuccess,       setCopySuccess]         = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (status === "authenticated" && role && role !== "client") {
      router.replace("/perfil");
    }
  }, [status, role, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/profile", { method: "GET", token })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.profile) return;
        const p: ClientProfile = data.profile;
        setForm({
          company_name:          p.company_name,
          cnpj:                  formatCnpj(p.cnpj),
          establishment_type:    p.establishment_type,
          responsible_name:      p.responsible_name,
          whatsapp:              formatWhatsapp(p.whatsapp),
          invoice_email:         p.invoice_email ?? "",
          delivery_zip_code:     p.delivery_zip_code ? formatZip(p.delivery_zip_code) : "",
          delivery_city:         p.delivery_city,
          delivery_state:        p.delivery_state,
          delivery_address_full: p.delivery_address_full,
          max_delivery_days_default: p.max_delivery_days_default ?? "",
          pref_email_monthly_report: (p as { pref_email_monthly_report?: boolean }).pref_email_monthly_report ?? true,
          pref_email_price_alerts:   (p as { pref_email_price_alerts?: boolean }).pref_email_price_alerts   ?? true,
          client_plan:           p.client_plan ?? "free",
        });
        setProAddresses(p.delivery_addresses ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Carrega dados de indicação em paralelo
    apiFetch("/api/referrals", { method: "GET", token })
      .then(async (res) => {
        if (res.ok) setReferralData(await res.json() as ReferralData);
      })
      .catch(() => {});
  }, [token]);

  // ── Lookup CEP no campo principal ──────────────────────────────────────────

  const lookupMainCep = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8 || !token) return;
    setCepLoading(true);
    setCepError("");
    setCepResult(null);
    try {
      const res = await apiFetch(`/api/address/cep/${digits}`, { method: "GET", token });
      const data = await res.json() as CepResult & { error?: string };
      if (!res.ok) { setCepError(data.error ?? "CEP não encontrado"); return; }
      setCepResult(data);
      setForm((f) => ({
        ...f,
        delivery_city:         data.city,
        delivery_state:        data.state,
        delivery_address_full: data.street
          ? `${data.street}${data.district ? ", " + data.district : ""}`
          : f.delivery_address_full,
      }));
    } catch {
      setCepError("Erro ao consultar CEP");
    } finally {
      setCepLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const digits = form.delivery_zip_code.replace(/\D/g, "");
    if (digits.length === 8) {
      const timer = setTimeout(() => lookupMainCep(digits), 400);
      return () => clearTimeout(timer);
    } else {
      setCepResult(null);
      setCepError("");
    }
  }, [form.delivery_zip_code, lookupMainCep]);

  // ── Lookup CEP no formulário de adicionar endereço (Pro) ──────────────────

  const lookupAddCep = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8 || !token) return;
    setAddAddrCepLoading(true);
    setAddAddrCepError("");
    setAddAddrCepResult(null);
    try {
      const res = await apiFetch(`/api/address/cep/${digits}`, { method: "GET", token });
      const data = await res.json() as CepResult & { error?: string };
      if (!res.ok) { setAddAddrCepError(data.error ?? "CEP não encontrado"); return; }
      setAddAddrCepResult(data);
      setAddAddrForm((f) => f ? {
        ...f,
        city:         data.city,
        state:        data.state,
        address_full: data.street ? `${data.street}${data.district ? ", " + data.district : ""}` : f.address_full,
      } : f);
    } catch {
      setAddAddrCepError("Erro ao consultar CEP");
    } finally {
      setAddAddrCepLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!addAddrForm) return;
    const digits = addAddrForm.zip.replace(/\D/g, "");
    if (digits.length === 8) {
      const timer = setTimeout(() => lookupAddCep(digits), 400);
      return () => clearTimeout(timer);
    } else {
      setAddAddrCepResult(null);
      setAddAddrCepError("");
    }
  }, [addAddrForm?.zip, lookupAddCep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit do formulário principal ────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    const zipDigits = form.delivery_zip_code.replace(/\D/g, "");

    const body: Record<string, unknown> = {
      establishment_type:    form.establishment_type,
      responsible_name:      form.responsible_name,
      whatsapp:              form.whatsapp.replace(/\D/g, ""),
      invoice_email:         form.invoice_email ? form.invoice_email.trim() : null,
      delivery_city:         form.delivery_city,
      delivery_state:        form.delivery_state.toUpperCase().slice(0, 2),
      delivery_address_full: form.delivery_address_full,
      delivery_zip_code:     zipDigits.length === 8 ? zipDigits : null,
      max_delivery_days_default: form.max_delivery_days_default === ""
        ? null
        : Number(form.max_delivery_days_default),
      pref_email_monthly_report: form.pref_email_monthly_report,
      pref_email_price_alerts:   form.pref_email_price_alerts,
    };

    try {
      const res = await apiFetch("/api/profile", { method: "PATCH", token, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        await updateSession();
        setSuccessMsg("Dados atualizados com sucesso");
        setTimeout(() => setSuccessMsg(""), 4000);
        setCepResult(null);
        setCepError("");
      } else {
        setErrorMsg(data.error ?? "Erro ao salvar. Tente novamente.");
      }
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // ── Adicionar endereço Pro ─────────────────────────────────────────────────

  async function saveNewAddress() {
    if (!token || !addAddrForm) return;
    const zipDigits = addAddrForm.zip.replace(/\D/g, "");
    if (zipDigits.length !== 8) { setAddAddrCepError("Informe um CEP válido"); return; }
    if (!addAddrForm.city) { setAddAddrCepError("CEP não reconhecido"); return; }

    setAddAddrSaving(true);
    try {
      const res = await apiFetch("/api/profile/addresses", {
        method: "POST",
        token,
        body: JSON.stringify({
          label:        addAddrForm.label || "Estabelecimento",
          zip_code:     zipDigits,
          city:         addAddrForm.city,
          state:        addAddrForm.state,
          address_full: addAddrForm.address_full || addAddrForm.city,
          is_default:   proAddresses.length === 0,
        }),
      });
      const data = await res.json() as { address?: DeliveryAddress; error?: string };
      if (!res.ok) { setAddAddrCepError(data.error ?? "Erro ao salvar"); return; }
      setProAddresses((prev) => [...prev, data.address!]);
      setAddAddrForm(null);
      setAddAddrCepResult(null);
    } catch {
      setAddAddrCepError("Erro de conexão");
    } finally {
      setAddAddrSaving(false);
    }
  }

  async function deleteAddress(id: string) {
    if (!token) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/profile/addresses/${id}`, { method: "DELETE", token });
      setProAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silencia — usuário tenta novamente
    } finally {
      setDeletingId(null);
    }
  }

  async function setDefaultAddress(id: string) {
    if (!token) return;
    await apiFetch(`/api/profile/addresses/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ is_default: true }),
    });
    setProAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
        </div>
      </div>
    );
  }

  const isPro = form.client_plan === "pro";

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-display font-bold text-[#0F172A]">Meu Perfil</h1>
          <p className="mt-1 text-sm text-slate-500">Dados do seu estabelecimento</p>
        </div>

        <div className="rounded-2xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* CNPJ — somente leitura */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#0F172A]">CNPJ</label>
              <div className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-slate-500">
                {form.cnpj}
              </div>
              <p className="text-xs text-slate-400">O CNPJ não pode ser alterado após o cadastro</p>
            </div>

            {/* Razão Social — somente leitura */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#0F172A]">Razão Social / Nome do estabelecimento</label>
              <div className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-slate-500">
                {form.company_name}
              </div>
              <p className="text-xs text-slate-400">A razão social não pode ser alterada após o cadastro</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#0F172A]">Tipo de estabelecimento</label>
              <select
                value={form.establishment_type}
                onChange={(e) => setForm((f) => ({ ...f, establishment_type: e.target.value }))}
                className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
              >
                {ESTABLISHMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <Input
              label="Nome do responsável"
              value={form.responsible_name}
              onChange={(e) => setForm((f) => ({ ...f, responsible_name: e.target.value }))}
              required
            />

            <Input
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: formatWhatsapp(e.target.value) }))}
              placeholder="(11) 99999-9999"
              required
            />

            <Input
              label="E-mail para envio de Nota Fiscal (opcional)"
              type="email"
              value={form.invoice_email}
              onChange={(e) => setForm((f) => ({ ...f, invoice_email: e.target.value }))}
              placeholder="financeiro@empresa.com.br"
              hint="Caso em branco, as notas fiscais serão enviadas para o e-mail de login"
            />

            <hr className="border-[#DBEAFE]" />

            {/* ── Endereço de entrega principal ─────────────────────────── */}
            <p className="text-sm font-semibold text-[#0F172A]">Endereço de entrega</p>

            {/* CEP — com auto-fill */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#0F172A]">CEP</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={form.delivery_zip_code}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_zip_code: formatZip(e.target.value) }))}
                  maxLength={9}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                />
                {cepLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
                  </div>
                )}
                {cepResult && !cepLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                    <Check size={14} />
                  </div>
                )}
              </div>
              {cepError && <p className="text-xs text-red-600">{cepError}</p>}
              {cepResult && (
                <p className="text-xs text-green-600">
                  <Check size={10} className="inline mr-0.5" />Preenchido automaticamente: {cepResult.city}, {cepResult.state}
                </p>
              )}
              <p className="text-xs text-slate-400">Informe o CEP para preencher cidade e estado automaticamente</p>
            </div>

            <div className="flex gap-3">
              <CityAutocomplete
                label="Cidade de entrega"
                value={form.delivery_city}
                onSelect={(opt: CityOption) => {
                  if (opt.city) {
                    setForm((f) => ({ ...f, delivery_city: opt.city, delivery_state: opt.state }));
                  }
                }}
                required
              />
              <StateSelect
                label="UF"
                value={form.delivery_state}
                onChange={(uf) => setForm((f) => ({ ...f, delivery_state: uf }))}
                required
                className="w-36"
              />
            </div>

            <Input
              label="Endereço de entrega (com número do estabelecimento)"
              value={form.delivery_address_full}
              onChange={(e) => setForm((f) => ({ ...f, delivery_address_full: e.target.value }))}
              placeholder="Rua, número do estabelecimento, complemento, bairro"
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#0F172A]">Prazo máximo preferido (dias)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={form.max_delivery_days_default}
                onChange={(e) => setForm((f) => ({ ...f, max_delivery_days_default: e.target.value }))}
                placeholder="Ex: 3"
                className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
              />
              <p className="text-xs text-slate-400">Deixe em branco para sem preferência</p>
            </div>

            <hr className="border-[#DBEAFE]" />

            {/* Preferências de notificação */}
            <div>
              <p className="mb-3 text-sm font-semibold text-[#0F172A]">Preferências de e-mail</p>
              <div className="space-y-3">
                {[
                  { key: "pref_email_monthly_report" as const, label: "Relatório mensal por e-mail", desc: "Resumo de cotações e economia enviado no dia 1 de cada mês" },
                  { key: "pref_email_price_alerts"   as const, label: "Alertas de queda de preço",  desc: "Notificação quando um produto que você cotou fica mais barato" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start justify-between gap-4 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{label}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${form[key] ? "bg-[#22C55E]" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form[key] ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {successMsg && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                <Check size={14} className="inline mr-1" />{successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <Button type="submit" fullWidth loading={saving} size="lg">
              Salvar alterações
            </Button>
          </form>
        </div>

        {/* ── Endereços adicionais (plano Pro) ──────────────────────────────── */}
        {isPro && (
          <div className="mt-6 rounded-2xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Endereços de entrega</p>
                <p className="text-xs text-slate-400">Até 3 endereços · plano Pro</p>
              </div>
              {proAddresses.length < 3 && !addAddrForm && (
                <button
                  onClick={() => setAddAddrForm({ label: "", zip: "", city: "", state: "", address_full: "" })}
                  className="flex items-center gap-1.5 rounded-xl border border-[#DBEAFE] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-[#F5F7FB]"
                >
                  <Plus size={12} />Adicionar
                </button>
              )}
            </div>

            {/* Lista de endereços */}
            <div className="space-y-2">
              {proAddresses.map((addr) => (
                <div key={addr.id} className="flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-[#2563EB]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#0F172A]">{addr.label}</p>
                      {addr.is_default && (
                        <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">padrão</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{addr.city}, {addr.state} · CEP {addr.zip_code.slice(0, 5)}-{addr.zip_code.slice(5)}</p>
                    <p className="text-xs text-slate-400 truncate">{addr.address_full}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!addr.is_default && (
                      <button
                        onClick={() => setDefaultAddress(addr.id)}
                        className="text-[11px] text-[#2563EB] hover:underline"
                      >
                        Definir padrão
                      </button>
                    )}
                    <button
                      onClick={() => deleteAddress(addr.id)}
                      disabled={deletingId === addr.id}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                      aria-label="Remover endereço"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {proAddresses.length === 0 && !addAddrForm && (
                <p className="text-xs text-slate-400">Nenhum endereço adicional cadastrado.</p>
              )}
            </div>

            {/* Formulário de adicionar */}
            {addAddrForm && (
              <div className="mt-3 rounded-xl border border-[#DBEAFE] bg-white p-4">
                <p className="mb-3 text-xs font-semibold text-slate-600">Novo endereço</p>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Nome / etiqueta (ex: Filial Centro)"
                    value={addAddrForm.label}
                    onChange={(e) => setAddAddrForm((f) => f ? { ...f, label: e.target.value } : f)}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                  />
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="CEP (00000-000)"
                      value={addAddrForm.zip}
                      onChange={(e) => setAddAddrForm((f) => f ? { ...f, zip: formatZip(e.target.value) } : f)}
                      maxLength={9}
                      className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                    />
                    {addAddrCepLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
                      </div>
                    )}
                  </div>
                  {addAddrCepError && <p className="text-xs text-red-600">{addAddrCepError}</p>}
                  {addAddrCepResult && (
                    <p className="text-xs text-green-600">
                      <Check size={10} className="inline mr-0.5" />{addAddrCepResult.city}, {addAddrCepResult.state}
                      {addAddrCepResult.street ? ` · ${addAddrCepResult.street}` : ""}
                    </p>
                  )}
                  <input
                    type="text"
                    placeholder="Endereço completo (número, complemento…)"
                    value={addAddrForm.address_full}
                    onChange={(e) => setAddAddrForm((f) => f ? { ...f, address_full: e.target.value } : f)}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveNewAddress}
                      disabled={addAddrSaving}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0F172A] py-2.5 text-xs font-bold text-white transition hover:bg-[#1E293B] disabled:opacity-60"
                    >
                      {addAddrSaving ? "Salvando…" : <><Check size={12} />Salvar endereço</>}
                    </button>
                    <button
                      onClick={() => { setAddAddrForm(null); setAddAddrCepResult(null); setAddAddrCepError(""); }}
                      className="rounded-xl border border-[#DBEAFE] px-4 text-xs font-semibold text-slate-500 hover:bg-[#F5F7FB]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Seção de Indicações ─────────────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Gift size={18} className="text-[#22C55E]" />
            <p className="text-sm font-semibold text-[#0F172A]">Programa de indicação</p>
            {referralData?.is_ambassador && (
              <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2.5 py-1 text-[11px] font-bold text-[#16A34A]">
                <Star size={10} />Embaixador Hubby
              </span>
            )}
          </div>

          {referralData ? (
            <>
              {/* Código + link */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500">Seu código</p>
                  <div className="flex items-center gap-2 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5">
                    <span className="flex-1 font-mono text-sm font-bold tracking-widest text-[#0F172A]">
                      {referralData.referral_code}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralData.referral_code);
                        setCopySuccess("code");
                        setTimeout(() => setCopySuccess(null), 2000);
                      }}
                      className="shrink-0 text-slate-400 hover:text-[#22C55E]"
                    >
                      {copySuccess === "code" ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500">Link de indicação</p>
                  <div className="flex items-center gap-2 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5">
                    <span className="flex-1 truncate text-xs text-slate-500">{referralData.referral_link}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralData.referral_link);
                        setCopySuccess("link");
                        setTimeout(() => setCopySuccess(null), 2000);
                      }}
                      className="shrink-0 text-slate-400 hover:text-[#22C55E]"
                    >
                      {copySuccess === "link" ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Progresso escalonado */}
              <div className="mb-4 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Progresso para Embaixador</p>
                  <span className="text-xs text-slate-400">{referralData.total_converted} / 3 conversões</span>
                </div>
                <div className="flex gap-2">
                  {[
                    { n: 1, days: 30, label: "30 dias" },
                    { n: 2, days: 60, label: "60 dias" },
                    { n: 3, days: 90, label: "Embaixador" },
                  ].map((m) => {
                    const done = referralData.total_converted >= m.n;
                    return (
                      <div key={m.n} className="flex flex-1 flex-col items-center gap-1">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? "bg-[#22C55E] text-white" : "bg-white border-2 border-[#DBEAFE] text-slate-400"}`}>
                          {done ? <Check size={12} /> : m.n}
                        </div>
                        <p className={`text-[10px] font-semibold ${done ? "text-[#22C55E]" : "text-slate-400"}`}>{m.label}</p>
                      </div>
                    );
                  })}
                </div>
                {!referralData.is_ambassador && referralData.next_milestone !== null && (
                  <p className="mt-3 text-center text-[11px] text-slate-500">
                    Próxima recompensa: +{referralData.next_reward_days} dias Pro na {referralData.next_milestone}ª conversão
                  </p>
                )}
              </div>

              {/* Estatísticas */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#DBEAFE] bg-white p-3 text-center">
                  <p className="text-xl font-black text-[#0F172A]">{referralData.total_sent}</p>
                  <p className="text-[11px] text-slate-400">enviadas</p>
                </div>
                <div className="rounded-xl border border-[#DBEAFE] bg-white p-3 text-center">
                  <p className="text-xl font-black text-[#22C55E]">{referralData.total_converted}</p>
                  <p className="text-[11px] text-slate-400">convertidas</p>
                </div>
                <div className="rounded-xl border border-[#DBEAFE] bg-white p-3 text-center">
                  <p className="text-xl font-black text-[#0F172A]">{referralData.total_days_earned}d</p>
                  <p className="text-[11px] text-slate-400">Pro ganhos</p>
                </div>
              </div>

              {/* Histórico */}
              {referralData.referrals.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Histórico</p>
                  <div className="space-y-1.5">
                    {referralData.referrals.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#0F172A]">{r.distributor_name}</p>
                          <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          {r.status === "converted" ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                              +{r.reward_days}d Pro
                            </span>
                          ) : r.status === "pending" ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              Aguardando pagamento
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Expirado</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
