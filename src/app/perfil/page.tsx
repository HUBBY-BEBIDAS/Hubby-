"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Check, X, AlertTriangle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DeliveryRegion = {
  id: string;
  city: string;
  state: string;
  delivery_days_business: number;
  route_days: string[];
  cutoff_time: string;
  minimum_order_cents: number;
};

type DistributorProfile = {
  id: string;
  company_name: string;
  cnpj: string;
  responsible_name: string;
  whatsapp_commercial: string;
  email_commercial: string;
  logo_key: string | null;
  payment_methods: string[];
  payment_terms_days: number[];
  credit_score_minimum: number;
  credit_accepts_restrictions: boolean;
  credit_min_cnpj_months: number;
  business_hours: Record<string, string | null> | null;
  accepts_orders_outside_hours: boolean;
  address?: {
    zipcode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
  } | null;
  delivery_mode?: "region" | "radius";
  max_delivery_radius_km?: number | null;
  radius_delivery_days_business?: number;
  radius_cutoff_time?: string;
  radius_route_days?: string[];
  delivery_regions: DeliveryRegion[];
};

type ProductsSummary = {
  active: number;
  inactive: number;
  last_updated_at: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS = [
  { value: "pix",           label: "Pix" },
  { value: "boleto",        label: "Boleto" },
  { value: "credit_card",   label: "Cartão de crédito" },
  { value: "bank_transfer", label: "Transferência bancária" },
  { value: "check",         label: "Cheque" },
] as const;


const CNPJ_MONTHS_OPTIONS = [
  { value: 0,   label: "Sem restrição" },
  { value: 6,   label: "6 meses" },
  { value: 12,  label: "1 ano" },
  { value: 24,  label: "2 anos" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCnpj(v: string) {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Componente de seção ──────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
      <div className="border-b border-[#DBEAFE] px-6 py-4">
        <h2 className="text-xs font-display font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function SaveMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  const isErr = msg.startsWith("Erro");
  return (
    <p className={`mt-3 text-sm font-medium ${isErr ? "text-red-600" : "text-green-600"}`}>
      {isErr ? <><X size={13} className="inline mr-1" /></> : <><Check size={13} className="inline mr-1" /></>}{msg}
    </p>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { data: session } = useSession({ required: true });
  const token = useApiToken();
  const router = useRouter();

  const role = (session?.user as { role?: string })?.role ?? "";

  // Clientes são redirecionados para a página de perfil do comprador
  useEffect(() => {
    if (role === "client") router.replace("/perfil/cliente");
  }, [role, router]);

  const [profile, setProfile] = useState<DistributorProfile | null>(null);
  const [summary, setSummary] = useState<ProductsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Seção 1: Dados da empresa ──────────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState({
    responsible_name: "",
    whatsapp_commercial: "",
    email_commercial: "",
    zipcode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "SP",
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState("");

  // ── Seção: Modo e Raio de Entrega ──────────────────────────────────────────
  const [deliveryMode, setDeliveryMode] = useState<"region" | "radius">("radius");
  const [maxRadiusKm, setMaxRadiusKm] = useState<number | string>(20);
  const [radiusDaysBusiness, setRadiusDaysBusiness] = useState<number>(3);
  const [radiusCutoffTime, setRadiusCutoffTime] = useState<string>("16:00");
  const [radiusRouteDays, setRadiusRouteDays] = useState<string[]>([
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
  ]);
  const [radiusSaving, setRadiusSaving] = useState(false);
  const [radiusMsg, setRadiusMsg] = useState("");
  const [profileCepLoading, setProfileCepLoading] = useState(false);

  // Auto busca CEP no perfil da empresa
  useEffect(() => {
    const cleanCep = companyForm.zipcode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setProfileCepLoading(true);
    fetch(`/api/address/cep/${cleanCep}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        setProfileCepLoading(false);
        if (d.city || d.street) {
          setCompanyForm((prev) => ({
            ...prev,
            street: d.street || prev.street,
            district: d.district || prev.district,
            city: d.city || prev.city,
            state: (d.state || prev.state).toUpperCase(),
          }));
        }
      })
      .catch(() => setProfileCepLoading(false));
  }, [companyForm.zipcode, token]);

  // Logo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState("");

  // ── Seção 2: Regiões ───────────────────────────────────────────────────────
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);

  // ── Seção 3: Pagamento ─────────────────────────────────────────────────────
  const [paymentForm, setPaymentForm] = useState({
    payment_methods: [] as string[],
    payment_terms_days: [] as number[],
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState("");

  // ── Seção 4: Crédito ───────────────────────────────────────────────────────
  const [creditForm, setCreditForm] = useState({
    use_platform_default: true,
    credit_score_minimum: 500,
    credit_accepts_restrictions: false,
    credit_min_cnpj_months: 6,
  });
  const [creditSaving, setCreditSaving] = useState(false);
  const [creditMsg, setCreditMsg] = useState("");

  // ── Seção 5: ERP ───────────────────────────────────────────────────────────
  type ErpConfig = {
    is_enterprise: boolean;
    webhook_url: string | null;
    webhook_secret_hint: string | null;
    webhook_enabled: boolean;
    has_api_key: boolean;
  };
  type WebhookLogEntry = {
    id: string;
    event: string;
    status_code: number | null;
    success: boolean;
    error_message: string | null;
    created_at: string;
  };
  const [erpConfig, setErpConfig] = useState<ErpConfig | null>(null);
  const [erpForm, setErpForm] = useState({ webhook_url: "", webhook_secret: "", webhook_enabled: false });
  const [erpSaving, setErpSaving] = useState(false);
  const [erpMsg, setErpMsg] = useState("");
  const [erpTesting, setErpTesting] = useState(false);
  const [erpTestResult, setErpTestResult] = useState<{ ok: boolean; status_code?: number | null; error_message?: string | null } | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogEntry[]>([]);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  // ── Seção: Horário de funcionamento ────────────────────────────────────────
  type DayKey = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday";
  const DAY_LABELS: Record<DayKey, string> = {
    monday:"Seg", tuesday:"Ter", wednesday:"Qua", thursday:"Qui", friday:"Sex", saturday:"Sáb", sunday:"Dom",
  };
  const ALL_DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as DayKey[];

  const [businessHoursForm, setBusinessHoursForm] = useState<Record<DayKey, { enabled: boolean; start: string; end: string }>>({
    monday:    { enabled: true,  start: "08:00", end: "18:00" },
    tuesday:   { enabled: true,  start: "08:00", end: "18:00" },
    wednesday: { enabled: true,  start: "08:00", end: "18:00" },
    thursday:  { enabled: true,  start: "08:00", end: "18:00" },
    friday:    { enabled: true,  start: "08:00", end: "18:00" },
    saturday:  { enabled: false, start: "08:00", end: "12:00" },
    sunday:    { enabled: false, start: "08:00", end: "12:00" },
  });
  const [acceptsOutsideHours, setAcceptsOutsideHours] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursMsg, setHoursMsg] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/distributor/profile", { method: "GET", token });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) {
        setLoading(false);
        return;
      }
      const p: DistributorProfile = data.profile;
      setProfile(p);
      setSummary(data.products_summary ?? null);
      setRegions(p.delivery_regions ?? []);
      const addr = (p.address as any) ?? {};
      setCompanyForm({
        responsible_name: p.responsible_name ?? "",
        whatsapp_commercial: p.whatsapp_commercial ?? "",
        email_commercial: p.email_commercial ?? "",
        zipcode: addr.zipcode ?? "",
        street: addr.street ?? "",
        number: addr.number ?? "",
        complement: addr.complement ?? "",
        district: addr.district ?? "",
        city: addr.city ?? "",
        state: addr.state ?? "SP",
      });

      // Configurações de entrega e raio
      setDeliveryMode(p.delivery_mode ?? "radius");
      setMaxRadiusKm(p.max_delivery_radius_km ?? 20);
      setRadiusDaysBusiness(p.radius_delivery_days_business ?? 3);
      setRadiusCutoffTime(p.radius_cutoff_time ?? "16:00");
      setRadiusRouteDays(
        p.radius_route_days && p.radius_route_days.length > 0
          ? p.radius_route_days
          : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
      );

      // Busca URL assinada da logo se houver
      if (p.logo_key) {
        if (p.logo_key.startsWith("data:")) {
          setLogoUrl(p.logo_key);
        } else {
          apiFetch("/api/distributor/logo/signed", { method: "GET", token })
            .then((r) => r.json())
            .then((d: { url?: string }) => { if (d.url) setLogoUrl(d.url); })
            .catch(() => null);
        }
      }
      setPaymentForm({
        payment_methods: p.payment_methods ?? [],
        payment_terms_days: p.payment_terms_days ?? [],
      });
      const isDefault =
        p.credit_score_minimum === 500 &&
        !p.credit_accepts_restrictions &&
        p.credit_min_cnpj_months === 6;
      setCreditForm({
        use_platform_default: isDefault,
        credit_score_minimum: p.credit_score_minimum,
        credit_accepts_restrictions: p.credit_accepts_restrictions,
        credit_min_cnpj_months: p.credit_min_cnpj_months,
      });
      const bh = p.business_hours as Record<string, string | null> | null;
      if (bh) {
        setBusinessHoursForm((prev) => {
          const next = { ...prev };
          for (const day of ALL_DAYS) {
            const val = bh[day];
            if (val) {
              const [start, end] = val.split("-");
              next[day] = { enabled: true, start: start ?? "08:00", end: end ?? "18:00" };
            } else if (day in bh) {
              next[day] = { ...prev[day], enabled: false };
            }
          }
          return next;
        });
      }
      setAcceptsOutsideHours(p.accepts_orders_outside_hours ?? false);

      apiFetch("/api/distributor/erp/config", { method: "GET", token }).then(async (r) => {
        if (!r.ok) return;
        const d = await r.json() as ErpConfig;
        setErpConfig(d);
        setErpForm({ webhook_url: d.webhook_url ?? "", webhook_secret: "", webhook_enabled: d.webhook_enabled });
        apiFetch("/api/distributor/erp/logs", { method: "GET", token }).then(async (lr) => {
          if (lr.ok) { const ld = await lr.json(); setWebhookLogs(ld.logs ?? []); }
        }).catch(() => {});
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Redireciona se não for distribuidora
  useEffect(() => {
    if (role && role !== "distributor_admin" && role !== "distributor_collaborator") {
      router.replace("/");
    }
  }, [role, router]);

  // ── Salvar dados da empresa ────────────────────────────────────────────────

  async function saveCompany() {
    if (!token) return;
    setCompanySaving(true);
    setCompanyMsg("");
    try {
      const payload = {
        responsible_name: companyForm.responsible_name,
        whatsapp_commercial: companyForm.whatsapp_commercial,
        email_commercial: companyForm.email_commercial,
        address: companyForm.zipcode && companyForm.city && companyForm.state ? {
          zipcode: companyForm.zipcode.replace(/\D/g, ""),
          street: companyForm.street,
          number: companyForm.number,
          complement: companyForm.complement,
          district: companyForm.district,
          city: companyForm.city,
          state: companyForm.state.toUpperCase(),
        } : null,
      };
      const res = await apiFetch("/api/distributor/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      setCompanySaving(false);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompanyMsg("✓ Dados da empresa e endereço salvos com sucesso.");
        if (data.profile) setProfile(data.profile);
      } else {
        const d = await res.json().catch(() => ({}));
        const detailMsg = d.details ? Object.values(d.details).flat().join(", ") : null;
        setCompanyMsg(`Erro: ${detailMsg || d.error || "Falha ao salvar."}`);
      }
    } catch (e: any) {
      setCompanySaving(false);
      setCompanyMsg(`Erro de conexão: ${e?.message ?? "Falha ao salvar."}`);
    }
  }

  // ── Salvar configurações do raio de entrega ──────────────────────────────

  async function saveRadiusSettings() {
    if (!token) return;
    setRadiusSaving(true);
    setRadiusMsg("");

    const parsedKm = parseInt(String(maxRadiusKm).replace(/\D/g, ""), 10);
    if (!parsedKm || isNaN(parsedKm) || parsedKm < 1 || parsedKm > 500) {
      setRadiusSaving(false);
      setRadiusMsg("Erro: Informe um raio numérico válido entre 1 e 500 KM.");
      return;
    }

    try {
      const res = await apiFetch("/api/distributor/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          delivery_mode: deliveryMode,
          max_delivery_radius_km: parsedKm,
          radius_delivery_days_business: Number(radiusDaysBusiness) || 1,
          radius_cutoff_time: (radiusCutoffTime || "16:00").slice(0, 5),
          radius_route_days: radiusRouteDays,
        }),
      });
      setRadiusSaving(false);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setMaxRadiusKm(parsedKm);
        setRadiusMsg(`✓ Raio de ${parsedKm} KM salvo e ativado no sistema!`);
        if (data.profile) setProfile(data.profile);
      } else {
        const d = await res.json().catch(() => ({}));
        const detailMsg = d.details ? Object.values(d.details).flat().join(", ") : null;
        setRadiusMsg(`Erro: ${detailMsg || d.error || "Falha ao salvar."}`);
      }
    } catch (e: any) {
      setRadiusSaving(false);
      setRadiusMsg(`Erro de conexão: ${e?.message ?? "Falha ao salvar."}`);
    }
  }

  // ── Upload de logo ─────────────────────────────────────────────────────────

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setLogoMsg("Erro: Formato não suportado. Use PNG, JPG, WebP ou SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg("Erro: Arquivo muito grande. Máximo 2 MB.");
      return;
    }

    setLogoUploading(true);
    setLogoMsg("");

    try {
      // 1. Consulta o servidor sobre o modo de upload disponível
      const presignRes = await apiFetch("/api/distributor/logo/presigned", {
        method: "POST",
        token,
        body: JSON.stringify({ mime_type: file.type }),
      });
      if (!presignRes.ok) {
        const d = await presignRes.json();
        setLogoMsg(`Erro: ${d.error ?? "Falha ao iniciar upload."}`);
        return;
      }

      const presignData = await presignRes.json() as {
        mode?: string;
        uploadUrl?: string;
        key?: string;
      };

      // ── Modo base64 (fallback dev — S3/R2 não configurado) ─────────────────
      if (presignData.mode === "base64") {
        const dataUrl = await readFileAsDataUrl(file);
        const patchRes = await apiFetch("/api/distributor/profile", {
          method: "PATCH",
          token,
          body: JSON.stringify({ logo_base64: dataUrl }),
        });
        if (!patchRes.ok) {
          const d = await patchRes.json();
          setLogoMsg(`Erro: ${d.error ?? "Falha ao salvar logo."}`);
          return;
        }
        setLogoUrl(dataUrl);
        setLogoMsg("Logo atualizada com sucesso.");
        return;
      }

      // ── Modo S3/R2 (produção) ───────────────────────────────────────────────
      const { uploadUrl, key } = presignData;
      if (!uploadUrl || !key) {
        setLogoMsg("Erro: Resposta inválida do servidor.");
        return;
      }

      // 2. PUT direto no storage
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        setLogoMsg("Erro: Falha ao enviar o arquivo para o storage.");
        return;
      }

      // 3. Salva a key no perfil
      const patchRes = await apiFetch("/api/distributor/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ logo_key: key }),
      });
      if (!patchRes.ok) {
        setLogoMsg("Erro: Logo enviada mas falhou ao salvar no perfil.");
        return;
      }

      // 4. Exibe preview local
      setLogoUrl(URL.createObjectURL(file));
      setLogoMsg("Logo atualizada com sucesso.");
    } catch {
      setLogoMsg("Erro: Falha inesperada no upload.");
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Salvar pagamento ───────────────────────────────────────────────────────

  async function savePayment() {
    if (!token) return;
    setPaymentSaving(true);
    setPaymentMsg("");
    const res = await apiFetch("/api/distributor/profile", {
      method: "PATCH",
      token,
      body: JSON.stringify(paymentForm),
    });
    setPaymentSaving(false);
    if (res.ok) {
      setPaymentMsg("Formas de pagamento salvas com sucesso.");
    } else {
      const d = await res.json();
      setPaymentMsg(`Erro: ${d.error ?? "Falha ao salvar."}`);
    }
  }

  // ── Salvar crédito ─────────────────────────────────────────────────────────

  async function saveCredit() {
    if (!token) return;
    setCreditSaving(true);
    setCreditMsg("");
    const body = creditForm.use_platform_default
      ? { use_platform_credit_default: true }
      : {
          use_platform_credit_default: false,
          credit_score_minimum: creditForm.credit_score_minimum,
          credit_accepts_restrictions: creditForm.credit_accepts_restrictions,
          credit_min_cnpj_months: creditForm.credit_min_cnpj_months,
        };
    const res = await apiFetch("/api/distributor/profile", {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    setCreditSaving(false);
    if (res.ok) {
      setCreditMsg("Critério de crédito salvo com sucesso.");
    } else {
      const d = await res.json();
      setCreditMsg(`Erro: ${d.error ?? "Falha ao salvar."}`);
    }
  }


  // ── Handlers Horário ──────────────────────────────────────────────────────

  async function saveBusinessHours() {
    if (!token) return;
    setHoursSaving(true); setHoursMsg("");
    const hours: Record<string, string | null> = {};
    for (const day of ALL_DAYS) {
      const c = businessHoursForm[day];
      hours[day] = c.enabled ? `${c.start}-${c.end}` : null;
    }
    const res = await apiFetch("/api/distributor/profile", {
      method: "PATCH", token,
      body: JSON.stringify({ business_hours: hours, accepts_orders_outside_hours: acceptsOutsideHours }),
    });
    setHoursSaving(false);
    if (res.ok) { setHoursMsg("Horários salvos"); setTimeout(() => setHoursMsg(""), 4000); }
    else { const d = await res.json(); setHoursMsg(`Erro: ${(d as {error?:string}).error ?? "Falha"}`); }
  }

  // ── Handlers ERP ──────────────────────────────────────────────────────────

  async function saveErpConfig() {
    if (!token) return;
    setErpSaving(true);
    setErpMsg("");
    try {
      const body: Record<string, unknown> = { webhook_enabled: erpForm.webhook_enabled };
      if (erpForm.webhook_url) body.webhook_url = erpForm.webhook_url;
      if (erpForm.webhook_secret) body.webhook_secret = erpForm.webhook_secret;
      const res = await apiFetch("/api/distributor/erp/config", { method: "PATCH", token, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        setErpMsg("Configuração salva com sucesso");
        setErpConfig((prev) => prev ? { ...prev, webhook_url: erpForm.webhook_url || prev.webhook_url, webhook_enabled: erpForm.webhook_enabled } : prev);
        setTimeout(() => setErpMsg(""), 4000);
      } else {
        setErpMsg(data.error ?? "Erro ao salvar");
      }
    } finally {
      setErpSaving(false);
    }
  }

  async function testWebhook() {
    if (!token) return;
    setErpTesting(true);
    setErpTestResult(null);
    try {
      const res = await apiFetch("/api/distributor/erp/webhook/test", { method: "POST", token });
      const data = await res.json();
      setErpTestResult({ ok: data.ok, status_code: data.status_code, error_message: data.error_message });
    } finally {
      setErpTesting(false);
    }
  }

  async function generateApiKey() {
    if (!token || !confirm("Gerar uma nova chave invalidará a anterior. Continuar?")) return;
    setGeneratingKey(true);
    setNewApiKey(null);
    try {
      const res = await apiFetch("/api/distributor/erp/config", { method: "POST", token });
      const data = await res.json();
      if (res.ok) {
        setNewApiKey(data.erp_api_key);
        setErpConfig((prev) => prev ? { ...prev, has_api_key: true } : prev);
      }
    } finally {
      setGeneratingKey(false);
    }
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="mb-6 h-40 animate-pulse rounded-3xl bg-[#DBEAFE]/50" />
          ))}
        </main>
      </div>
    );
  }

  const isAdmin = role === "distributor_admin";

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
            Perfil da distribuidora
          </h1>
          {!isAdmin && (
            <p className="mt-1 text-sm text-slate-500">
              Somente administradores podem editar o perfil.
            </p>
          )}
        </div>

        {/* ── 1. Dados da empresa ─────────────────────────────────────────── */}
        <Section title="Dados da empresa">
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-2xl bg-[#F5F7FB] px-4 py-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Razão social</p>
              <p className="mt-0.5 font-medium text-[#0F172A]">{profile?.company_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">CNPJ</p>
              <p className="mt-0.5 font-mono font-medium text-[#0F172A]">
                {profile?.cnpj ? formatCnpj(profile.cnpj) : "—"}
              </p>
            </div>
          </div>

          <p className="mb-4 text-xs text-slate-400">
            Razão social e CNPJ são definidos no cadastro e validados na Receita Federal. Para alterá-los,{" "}
            <a href="mailto:contato@sic.com.br" className="text-[#22C55E] underline">
              entre em contato com o suporte
            </a>.
          </p>

          {/* Logo */}
          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-[#0F172A]">Logo da empresa</p>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB]">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                ) : (
                  <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                {isAdmin && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={logoUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoUploading ? "Enviando…" : "Trocar logo"}
                    </Button>
                    <p className="mt-1 text-xs text-slate-400">PNG, JPG, WebP ou SVG · máx. 2 MB</p>
                  </>
                )}
                {logoMsg && (
                  <p className={`mt-1 text-xs font-medium ${logoMsg.startsWith("Erro") ? "text-red-600" : "text-green-600"}`}>
                    {logoMsg.startsWith("Erro") ? <><X size={13} className="inline mr-1" /></> : <><Check size={13} className="inline mr-1" /></>}{logoMsg}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#0F172A]">
                Nome do responsável
              </label>
              <input
                type="text"
                value={companyForm.responsible_name}
                onChange={(e) => setCompanyForm((p) => ({ ...p, responsible_name: e.target.value }))}
                disabled={!isAdmin}
                className="w-full rounded-xl border border-[#DBEAFE] bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                placeholder="João Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">
                  WhatsApp comercial
                </label>
                <input
                  type="tel"
                  value={companyForm.whatsapp_commercial}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, whatsapp_commercial: e.target.value }))}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  placeholder="11999998888"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">
                  Email comercial
                </label>
                <input
                  type="email"
                  value={companyForm.email_commercial}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, email_commercial: e.target.value }))}
                  disabled={!isAdmin}
                  className="w-full rounded-xl border border-[#DBEAFE] bg-white px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  placeholder="vendas@empresa.com.br"
                />
              </div>
            </div>

            {/* Endereço da Sede / Galpão */}
            <div className="mt-4 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#22C55E]">
                Endereço da Sede / Galpão (Usado para cálculo do Raio e Geolocalização)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">CEP</label>
                  <input
                    type="text"
                    value={companyForm.zipcode}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, zipcode: e.target.value }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="00000-000"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Rua / Logradouro</label>
                  <input
                    type="text"
                    value={companyForm.street}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, street: e.target.value }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="Av. Paulista"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Número</label>
                  <input
                    type="text"
                    value={companyForm.number}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, number: e.target.value }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="1000"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Complemento</label>
                  <input
                    type="text"
                    value={companyForm.complement}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, complement: e.target.value }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="Galpão 3 (opcional)"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Bairro</label>
                  <input
                    type="text"
                    value={companyForm.district}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, district: e.target.value }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="Bela Vista"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">Cidade</label>
                  <input
                    type="text"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, city: e.target.value }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs font-bold uppercase text-[#0F172A] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-100"
                    placeholder="SP"
                  />
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="mt-4 flex items-center justify-between">
              <Button size="sm" loading={companySaving} onClick={saveCompany}>
                Salvar dados da empresa
              </Button>
              <SaveMsg msg={companyMsg} />
            </div>
          )}
        </Section>

        {/* ── 2. Regiões e Raio de Entrega ─────────────────────────────────── */}
        <Section title="Regiões e Raio de Entrega">
          <p className="mb-4 text-xs text-slate-500">
            Defina como sua distribuidora atende os compradores: por raio geográfico em KM a partir do seu galpão ou por lista de cidades.
          </p>

          {/* Seleção do Modo de Entrega */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setDeliveryMode("radius")}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
                deliveryMode === "radius"
                  ? "border-[#22C55E] bg-[#22C55E]/5 ring-2 ring-[#22C55E]/20"
                  : "border-[#DBEAFE] bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${deliveryMode === "radius" ? "bg-[#22C55E]" : "bg-slate-300"}`} />
                <p className="text-sm font-bold text-[#0F172A]">Raio Máximo em KM</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Atendimento automático por geolocalização (calculado via CEP). Recomendado para pequenas distribuidoras.
              </p>
            </button>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setDeliveryMode("region")}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
                deliveryMode === "region"
                  ? "border-[#22C55E] bg-[#22C55E]/5 ring-2 ring-[#22C55E]/20"
                  : "border-[#DBEAFE] bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${deliveryMode === "region" ? "bg-[#22C55E]" : "bg-slate-300"}`} />
                <p className="text-sm font-bold text-[#0F172A]">Cidades / Tabela por Região</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Selecione manualmente as cidades e estados atendidos via planilha ou lista de municípios.
              </p>
            </button>
          </div>

          {/* Configurações quando o Modo por Raio está ativo */}
          {deliveryMode === "radius" && (
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-5 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Raio Máximo de Entrega (KM a partir da sua empresa)
                </label>
                
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {[10, 20, 30, 50].map((km) => {
                    const isSelected = Number(maxRadiusKm) === km;
                    return (
                      <button
                        key={km}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setMaxRadiusKm(km)}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                          isSelected
                            ? "bg-[#22C55E] text-white shadow-md shadow-green-500/20 ring-2 ring-[#22C55E]/40"
                            : "bg-white border border-[#DBEAFE] text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {isSelected && <Check size={14} className="stroke-[3]" />}
                        {km} km
                      </button>
                    );
                  })}

                  {/* Opção de Raio Personalizado / Outro */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      if ([10, 20, 30, 50].includes(Number(maxRadiusKm))) {
                        setMaxRadiusKm(15);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                      !([10, 20, 30, 50].includes(Number(maxRadiusKm)))
                        ? "bg-[#22C55E] text-white shadow-md shadow-green-500/20 ring-2 ring-[#22C55E]/40"
                        : "bg-white border border-[#DBEAFE] text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {!([10, 20, 30, 50].includes(Number(maxRadiusKm))) && <Check size={14} className="stroke-[3]" />}
                    Personalizado
                  </button>

                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs text-slate-500 font-medium">Outro:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={maxRadiusKm}
                      onChange={(e) => setMaxRadiusKm(e.target.value.replace(/\D/g, ""))}
                      disabled={!isAdmin}
                      placeholder="Ex: 25"
                      className={`w-20 rounded-xl border px-3 py-2 text-xs font-extrabold text-[#0F172A] outline-none transition-all ${
                        !([10, 20, 30, 50].includes(Number(maxRadiusKm)))
                          ? "border-[#22C55E] bg-green-50/50 ring-2 ring-[#22C55E]/30"
                          : "border-[#DBEAFE] bg-white focus:border-[#22C55E]"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-600">km</span>
                  </div>
                </div>

                {/* Badge Verdinho de Raio Ativo */}
                <div className="flex items-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-2.5 text-xs font-bold text-[#16A34A]">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16A34A]"></span>
                  </span>
                  <span>Raio Selecionado: <strong className="text-emerald-800 text-sm font-extrabold">{maxRadiusKm || 0} KM</strong></span>
                  <span className="text-[11px] font-medium text-slate-500 ml-auto">
                    (Clientes a até {maxRadiusKm || 0} km verão seu catálogo)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">
                    Prazo de entrega (dias úteis)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={radiusDaysBusiness}
                    onChange={(e) => setRadiusDaysBusiness(Number(e.target.value))}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none"
                    placeholder="3"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0F172A]">
                    Horário limite de corte (pedidos no dia)
                  </label>
                  <input
                    type="time"
                    value={radiusCutoffTime}
                    onChange={(e) => setRadiusCutoffTime(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#22C55E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#0F172A]">
                  Dias de entrega na semana
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "monday", label: "Seg" },
                    { value: "tuesday", label: "Ter" },
                    { value: "wednesday", label: "Qua" },
                    { value: "thursday", label: "Qui" },
                    { value: "friday", label: "Sex" },
                    { value: "saturday", label: "Sáb" },
                    { value: "sunday", label: "Dom" },
                  ].map((d) => {
                    const selected = radiusRouteDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => {
                          setRadiusRouteDays((prev) =>
                            selected ? prev.filter((item) => item !== d.value) : [...prev, d.value]
                          );
                        }}
                        className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                          selected
                            ? "bg-[#22C55E] text-white shadow-sm"
                            : "bg-white border border-[#DBEAFE] text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isAdmin && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                  <Button size="sm" loading={radiusSaving} onClick={saveRadiusSettings}>
                    Salvar Configurações de Raio
                  </Button>
                  <SaveMsg msg={radiusMsg} />
                </div>
              )}
            </div>
          )}

          {/* Configurações quando o Modo por Região/Cidades está ativo */}
          {deliveryMode === "region" && (
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">
                    {regions.length === 0 ? "Nenhuma região cadastrada ainda." : `${regions.length} regiões em ${new Set(regions.map((r) => r.state)).size} estados`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Gerencie a lista de cidades onde sua distribuidora realiza entregas por tabela.
                  </p>
                </div>
                <Link href="/painel/regioes">
                  <Button size="sm" variant="secondary">
                    Gerenciar cidades e regiões →
                  </Button>
                </Link>
              </div>

              {isAdmin && (
                <div className="mt-4 pt-3 flex items-center justify-between border-t border-slate-200/60">
                  <Button size="sm" loading={radiusSaving} onClick={saveRadiusSettings}>
                    Salvar Modo Cidades
                  </Button>
                  <SaveMsg msg={radiusMsg} />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── 2.5 Horário de funcionamento ─────────────────────────────────── */}
        <Section title="Horário de funcionamento">
          <p className="mb-4 text-xs text-slate-400">
            Defina o horário de atendimento por dia da semana. Compradores verão um badge "Aberto agora" no ranking.
          </p>
          <div className="space-y-2">
            {ALL_DAYS.map((day) => {
              const cfg = businessHoursForm[day];
              return (
                <div key={day} className="flex items-center gap-3 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-2.5">
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setBusinessHoursForm((prev) => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))}
                    className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${cfg.enabled ? "bg-green-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${cfg.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <span className="w-8 text-xs font-semibold text-slate-500">{DAY_LABELS[day]}</span>
                  {cfg.enabled ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="time" value={cfg.start} disabled={!isAdmin}
                        onChange={(e) => setBusinessHoursForm((prev) => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))}
                        className="rounded-lg border border-[#DBEAFE] bg-white px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed" />
                      <span className="text-slate-400">até</span>
                      <input type="time" value={cfg.end} disabled={!isAdmin}
                        onChange={(e) => setBusinessHoursForm((prev) => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))}
                        className="rounded-lg border border-[#DBEAFE] bg-white px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed" />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <input type="checkbox" disabled={!isAdmin} checked={acceptsOutsideHours}
              onChange={(e) => setAcceptsOutsideHours(e.target.checked)}
              className="h-4 w-4 rounded accent-[#22C55E]" />
            <span className="text-sm text-[#0F172A]">
              Aceitar pedidos fora do horário <span className="text-xs text-slate-400">(pedido entra na fila para o próximo dia útil)</span>
            </span>
          </label>

          {isAdmin && (
            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" loading={hoursSaving} onClick={saveBusinessHours}>
                Salvar horários
              </Button>
              <SaveMsg msg={hoursMsg} />
            </div>
          )}
        </Section>

        {/* ── 3. Formas de pagamento ───────────────────────────────────────── */}
        <Section title="Formas de pagamento">
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Métodos aceitos
              </p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_OPTIONS.map(({ value, label }) => {
                  const checked = paymentForm.payment_methods.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() =>
                        setPaymentForm((p) => ({
                          ...p,
                          payment_methods: checked
                            ? p.payment_methods.filter((m) => m !== value)
                            : [...p.payment_methods, value],
                        }))
                      }
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                        checked
                          ? "bg-[#22C55E] text-white"
                          : "border border-[#DBEAFE] bg-[#F5F7FB] text-slate-600 hover:bg-[#F0FDF4]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Prazos de pagamento oferecidos
              </p>
              <div className="flex flex-wrap gap-2">
                {[0, 7, 14, 28, 35, 42].map((days) => {
                  const checked = paymentForm.payment_terms_days.includes(days);
                  return (
                    <button
                      key={days}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() =>
                        setPaymentForm((p) => ({
                          ...p,
                          payment_terms_days: checked
                            ? p.payment_terms_days.filter((d) => d !== days)
                            : [...p.payment_terms_days, days].sort((a, b) => a - b),
                        }))
                      }
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                        checked
                          ? "bg-[#22C55E] text-white"
                          : "border border-[#DBEAFE] bg-[#F5F7FB] text-slate-600 hover:bg-[#F0FDF4]",
                      ].join(" ")}
                    >
                      {days === 0 ? "À vista" : `${days} dias`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="mt-4 flex items-center justify-between">
              <Button size="sm" loading={paymentSaving} onClick={savePayment}>
                Salvar formas de pagamento
              </Button>
              <SaveMsg msg={paymentMsg} />
            </div>
          )}
        </Section>

        {/* ── 4. Critério de crédito ───────────────────────────────────────── */}
        <Section title="Critério de análise de crédito">
          <p className="mb-4 text-sm text-slate-500">
            Define quando um cliente é aprovado automaticamente para fazer pedidos. Scores são consultados via bureau de crédito (Serasa/Boa Vista).
          </p>

          {/* Toggle padrão vs personalizado */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-[#DBEAFE]">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setCreditForm((p) => ({ ...p, use_platform_default: true }))}
              className={[
                "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                creditForm.use_platform_default
                  ? "bg-[#F0FDF4]"
                  : "bg-white hover:bg-[#F5F7FB]",
              ].join(" ")}
            >
              <div className={[
                "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                creditForm.use_platform_default
                  ? "border-[#22C55E] bg-[#22C55E]"
                  : "border-slate-300 bg-white",
              ].join(" ")} />
              <div>
                <p className="font-bold text-[#0F172A]">Usar critério padrão da plataforma</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Score ≥ 500 · Sem restrições graves · CNPJ ativo há ≥ 6 meses
                </p>
              </div>
            </button>

            <div className="border-t border-[#DBEAFE]" />

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setCreditForm((p) => ({ ...p, use_platform_default: false }))}
              className={[
                "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                !creditForm.use_platform_default
                  ? "bg-[#F0FDF4]"
                  : "bg-white hover:bg-[#F5F7FB]",
              ].join(" ")}
            >
              <div className={[
                "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                !creditForm.use_platform_default
                  ? "border-[#22C55E] bg-[#22C55E]"
                  : "border-slate-300 bg-white",
              ].join(" ")} />
              <div>
                <p className="font-bold text-[#0F172A]">Definir meu próprio critério</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Configure o score mínimo, tolerância a restrições e tempo mínimo de CNPJ
                </p>
              </div>
            </button>
          </div>

          {/* Critério personalizado */}
          {!creditForm.use_platform_default && (
            <div className="space-y-5 rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#0F172A]">
                  Score mínimo para aprovação automática
                  <span className="ml-2 text-xs font-medium text-slate-400">(0 = sem limite, 1000 = máximo)</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={50}
                    disabled={!isAdmin}
                    value={creditForm.credit_score_minimum}
                    onChange={(e) => setCreditForm((p) => ({ ...p, credit_score_minimum: Number(e.target.value) }))}
                    className="flex-1 accent-[#22C55E] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    disabled={!isAdmin}
                    value={creditForm.credit_score_minimum}
                    onChange={(e) => setCreditForm((p) => ({ ...p, credit_score_minimum: Number(e.target.value) }))}
                    className="w-20 rounded-xl border border-[#DBEAFE] bg-white px-3 py-1.5 text-center text-sm font-bold text-[#22C55E] focus:border-[#22C55E] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Score &lt; {creditForm.credit_score_minimum} → aprovação manual pelo seu time
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#0F172A]">
                  Aceitar clientes com restrições no bureau?
                </p>
                <div className="flex gap-3">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setCreditForm((p) => ({ ...p, credit_accepts_restrictions: v }))}
                      className={[
                        "rounded-xl px-5 py-2 text-sm font-medium transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                        creditForm.credit_accepts_restrictions === v
                          ? "bg-[#22C55E] text-white"
                          : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#F0FDF4]",
                      ].join(" ")}
                    >
                      {v ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Restrição = protestos, pendências financeiras ou CNPJ inapto
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#0F172A]">
                  Tempo mínimo de CNPJ ativo
                </p>
                <div className="flex flex-wrap gap-2">
                  {CNPJ_MONTHS_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setCreditForm((p) => ({ ...p, credit_min_cnpj_months: value }))}
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
                        creditForm.credit_min_cnpj_months === value
                          ? "bg-[#22C55E] text-white"
                          : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#F0FDF4]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 flex items-center justify-between">
              <Button size="sm" loading={creditSaving} onClick={saveCredit}>
                Salvar critério de crédito
              </Button>
              <SaveMsg msg={creditMsg} />
            </div>
          )}
        </Section>

        {/* ── 5. Catálogo de produtos ──────────────────────────────────────── */}
        <Section title="Catálogo de produtos">
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[120px] rounded-2xl bg-[#F0FDF4] px-4 py-3 text-center">
              <p className="text-3xl font-semibold text-[#22C55E]">{summary?.active ?? 0}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[#22C55E]/70">
                ativos
              </p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-2xl bg-[#F5F7FB] px-4 py-3 text-center">
              <p className="text-3xl font-semibold text-slate-400">{summary?.inactive ?? 0}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                inativos
              </p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-2xl bg-[#F5F7FB] px-4 py-3 text-center">
              <p className="text-sm font-bold text-[#0F172A]">
                {formatDate(summary?.last_updated_at ?? null)}
              </p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                última atualização
              </p>
            </div>
          </div>

          <Link href="/painel/produtos">
            <Button fullWidth variant="secondary">
              Gerenciar catálogo de produtos →
            </Button>
          </Link>
        </Section>

        {/* ═══════════════ SEÇÃO ERP ═══════════════ */}
        <Section title="Integração ERP" subtitle="Webhook de saída e API key para sistemas externos">
          <div className="flex items-center justify-between mb-5">
            {erpConfig?.is_enterprise ? (
              <span className="rounded-full bg-[#22C55E]/10 px-3 py-1 text-xs font-bold text-[#22C55E]">Enterprise ativo</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Plano Enterprise</span>
            )}
          </div>

          {!erpConfig?.is_enterprise ? (
            <div className="rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] p-6 text-center">
              <p className="mt-2 font-bold text-[#0F172A]">Disponível no plano Enterprise</p>
              <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">
                Conecte seu ERP à plataforma via webhook e API key para sincronizar pedidos automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Toggle + URL + Secret */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">Webhook ativo</p>
                    <p className="text-xs text-slate-500">Disparar POST ao ERP quando um pedido for recebido</p>
                  </div>
                  <button
                    onClick={() => setErpForm((f) => ({ ...f, webhook_enabled: !f.webhook_enabled }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${erpForm.webhook_enabled ? "bg-[#22C55E]" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${erpForm.webhook_enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#0F172A]">URL do webhook</label>
                  <input
                    type="url"
                    value={erpForm.webhook_url}
                    onChange={(e) => setErpForm((f) => ({ ...f, webhook_url: e.target.value }))}
                    placeholder="https://seu-erp.com.br/webhooks/hubby"
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#0F172A]">Secret do webhook</label>
                  <input
                    type="password"
                    value={erpForm.webhook_secret}
                    onChange={(e) => setErpForm((f) => ({ ...f, webhook_secret: e.target.value }))}
                    placeholder={erpConfig.webhook_secret_hint ? `Atual: ${erpConfig.webhook_secret_hint}` : "Defina um secret"}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                  />
                  <p className="text-xs text-slate-400">Enviado como <code className="rounded bg-slate-100 px-1">X-Hubby-Signature: sha256=&lt;hmac&gt;</code> — deixe em branco para manter o atual</p>
                </div>

                {erpMsg && (
                  <p className={`text-sm font-medium ${erpMsg.includes("sucesso") ? "text-[#22C55E]" : "text-red-600"}`}>{erpMsg}</p>
                )}

                <div className="flex gap-3">
                  <Button variant="primary" size="sm" loading={erpSaving} onClick={saveErpConfig}>
                    Salvar configuração
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={erpTesting}
                    disabled={!erpConfig.webhook_url && !erpForm.webhook_url}
                    onClick={testWebhook}
                  >
                    Testar webhook
                  </Button>
                </div>

                {erpTestResult && (
                  <div className={`rounded-xl px-4 py-3 text-sm ${erpTestResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {erpTestResult.ok
                      ? `Webhook recebido com sucesso (HTTP ${erpTestResult.status_code})`
                      : `Falha — ${erpTestResult.error_message ?? `HTTP ${erpTestResult.status_code}`}`}
                  </div>
                )}
              </div>

              <div className="h-px bg-[#DBEAFE]" />

              {/* API Key */}
              <div>
                <h3 className="mb-1 text-sm font-display font-bold text-[#0F172A]">API Key</h3>
                <p className="mb-3 text-xs text-slate-500">
                  Use para autenticar chamadas ao endpoint{" "}
                  <code className="rounded bg-slate-100 px-1">POST /api/integrations/erp/orders</code>
                </p>

                {newApiKey ? (
                  <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/5 p-4">
                    <p className="mb-2 text-xs font-bold text-[#22C55E]"><Check size={11} className="inline mr-1" />Nova chave gerada — guarde agora, não será exibida novamente:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg border border-[#DBEAFE] bg-white px-3 py-2 font-mono text-xs text-[#0F172A]">
                        {newApiKey}
                      </code>
                      <button
                        onClick={() => { if (newApiKey) navigator.clipboard.writeText(newApiKey); }}
                        className="shrink-0 rounded-lg border border-[#DBEAFE] bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-[#F5F7FB]"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-slate-500">
                      {erpConfig.has_api_key ? "••••••••••••••••••••••••••••••••" : "Nenhuma chave gerada"}
                    </div>
                    <Button variant="secondary" size="sm" loading={generatingKey} onClick={generateApiKey}>
                      {erpConfig.has_api_key ? "Gerar nova" : "Gerar chave"}
                    </Button>
                  </div>
                )}

                {erpConfig.has_api_key && !newApiKey && (
                  <p className="mt-2 text-xs text-amber-600"><AlertTriangle size={11} className="inline mr-1" />Gerar uma nova chave invalida a anterior imediatamente.</p>
                )}
              </div>

              <div className="h-px bg-[#DBEAFE]" />

              {/* Log */}
              <div>
                <h3 className="mb-3 text-sm font-display font-bold text-[#0F172A]">Log de requisições</h3>
                {webhookLogs.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma requisição registrada ainda.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-[#DBEAFE]">
                    <table className="w-full text-xs">
                      <thead className="border-b border-[#DBEAFE] bg-[#F5F7FB]">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Evento</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Status</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Resultado</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DBEAFE]">
                        {webhookLogs.slice(0, 10).map((log) => (
                          <tr key={log.id} className="bg-white">
                            <td className="px-3 py-2 font-mono text-[#0F172A]">{log.event}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 font-bold ${log.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {log.success ? <Check size={11} className="inline mr-0.5 text-green-600" /> : <X size={11} className="inline mr-0.5 text-red-500" />}{log.status_code ?? "—"}
                              </span>
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-2 text-slate-500">{log.error_message ?? "OK"}</td>
                            <td className="px-3 py-2 text-slate-400">
                              {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">Últimas 100 chamadas · atualizado ao recarregar</p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
                <p className="text-sm text-slate-600">Exemplos de payload e validação de assinatura</p>
                <a href="#" className="text-sm font-bold text-[#22C55E] hover:underline">Ver documentação →</a>
              </div>
            </div>
          )}
        </Section>

      </main>
    </div>
  );
}
