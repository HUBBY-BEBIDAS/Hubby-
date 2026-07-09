"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Badge } from "@/components/ui/Badge";
import {
  Hand, Package, Map, CheckCircle, BarChart2, Pencil, Lightbulb,
  Download, FolderOpen, Sparkles, Check, AlertTriangle,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type OnboardingState = {
  onboarding_completed: boolean;
  onboarding_step: number;
  company_name: string;
  has_products: boolean;
  has_regions: boolean;
  products_count: number;
  regions_count: number;
  credit_score_minimum: number;
  credit_accepts_restrictions: boolean;
  credit_min_cnpj_months: number;
};

const TOTAL_STEPS = 5;
const WEEK_DAYS = [
  { value: "monday", label: "Seg" }, { value: "tuesday", label: "Ter" },
  { value: "wednesday", label: "Qua" }, { value: "thursday", label: "Qui" },
  { value: "friday", label: "Sex" }, { value: "saturday", label: "Sáb" },
];
const CATEGORIES = [
  "beer","whisky","vodka","gin","rum","cachaca","wine","sparkling","energy","soft_drink","water","juice","other"
];
const CATEGORY_LABELS: Record<string, string> = {
  beer:"Cerveja",whisky:"Whisky",vodka:"Vodka",gin:"Gin",rum:"Rum",cachaca:"Cachaça",
  wine:"Vinho",sparkling:"Espumante",energy:"Energético",soft_drink:"Refrigerante",
  water:"Água",juice:"Suco",other:"Outro",
};
const PACKAGING_TYPES = ["garrafa","lata","barril","caixa","fardo","tetra_pak","other"];
const PACKAGING_LABELS: Record<string, string> = {
  garrafa:"Garrafa",lata:"Lata",barril:"Barril",caixa:"Caixa",fardo:"Fardo",tetra_pak:"Tetra Pak",other:"Outro",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[12px] font-medium text-slate-500">
          Passo {step} de {TOTAL_STEPS}
        </span>
        <span className="font-mono text-[12px] font-medium text-slate-400">{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-[#DBEAFE]">
        <div
          className="h-1 rounded-full bg-[#22C55E] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-xl rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[24px] font-display font-bold text-[#0F172A] leading-tight">{children}</h2>;
}

function StepSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[14px] text-[#475569] leading-relaxed">{children}</p>;
}

function PrimaryBtn({ children, onClick, loading, disabled, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; loading?: boolean; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#22C55E] py-3 text-[15px] font-semibold text-white shadow-lg shadow-green-500/20 transition hover:bg-green-500 disabled:opacity-50"
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
      {children}
    </button>
  );
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full text-center text-sm text-slate-400 transition hover:text-slate-600"
    >
      Pular por agora — configurar depois
    </button>
  );
}

// ─── Passo 1 — Boas-vindas ────────────────────────────────────────────────────

function Step1Welcome({ state, onNext }: { state: OnboardingState; onNext: () => void }) {
  return (
    <Card>
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#22C55E]/10">
        <Hand size={32} className="text-[#22C55E]" />
      </div>
      <StepTitle>Bem-vinda à Hubby,<br />{state.company_name}!</StepTitle>
      <StepSubtitle>
        Vamos configurar seu perfil em 4 passos rápidos para você já começar a receber cotações.
      </StepSubtitle>

      <div className="mt-6 space-y-3">
        {[
          { icon: <Package size={18} />, label: "Cadastrar seus produtos" },
          { icon: <Map size={18} />, label: "Configurar regiões de entrega" },
          { icon: <CheckCircle size={18} />, label: "Definir critérios de crédito" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
            <span className="text-[#22C55E]">{item.icon}</span>
            <span className="text-sm font-medium text-[#0F172A]">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <PrimaryBtn onClick={onNext}>Começar configuração →</PrimaryBtn>
      </div>
    </Card>
  );
}

// ─── Passo 2 — Produtos ───────────────────────────────────────────────────────

function Step2Products({ token, state, onNext, onSkip }: {
  token: string | null; state: OnboardingState; onNext: () => void; onSkip: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "manual" | "upload">("choose");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [preview, setPreview] = useState<{ 
    imported: number; 
    ignored: number; 
    token: string;
    validRows: any[];
    errorsList: any[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual form state
  const [form, setForm] = useState({
    name: "", brand: "", category: "beer", packaging_type: "garrafa",
    packaging_volume_ml: 600, price_cents: 0,
  });
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(state.products_count);
  const [saveMsg, setSaveMsg] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setUploadMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/distributor/products/import/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setUploadMsg(data.error ?? "Erro no upload"); return; }
      setPreview({ 
        imported: data.summary?.new_count ?? 0, 
        ignored: data.summary?.error_count ?? 0,
        token: data.token,
        validRows: data.valid_rows ?? [],
        errorsList: data.errors ?? [],
      });
    } catch { setUploadMsg("Erro de conexão"); }
    finally { setUploading(false); }
  }

  async function confirmImport() {
    if (!token || !preview) return;
    setConfirming(true);
    const res = await apiFetch("/api/distributor/products/import/confirm", {
      method: "POST", 
      token, 
      body: JSON.stringify({ 
        token: preview.token,
        products: preview.validRows,
      }),
    });
    setConfirming(false);
    if (res.ok) onNext();
    else {
      const d = await res.json();
      setUploadMsg(d.error ?? "Erro ao confirmar importação");
    }
  }

  async function handleManualSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    const res = await apiFetch("/api/distributor/products", {
      method: "POST", token,
      body: JSON.stringify({
        name: form.name, brand: form.brand, category: form.category,
        packaging_type: form.packaging_type,
        packaging_volume_ml: Number(form.packaging_volume_ml),
        price_cents: Math.round(Number(form.price_cents) * 100),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const count = savedCount + 1;
      setSavedCount(count);
      setSaveMsg(`OK Produto salvo! Total: ${count}`);
      setForm({ name: "", brand: "", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 600, price_cents: 0 });
    } else {
      const d = await res.json();
      setSaveMsg(d.error ?? "Erro ao salvar");
    }
  }

  if (mode === "choose") return (
    <Card>
      <StepTitle>Quais produtos você distribui?</StepTitle>
      <StepSubtitle>Adicione ao menos 1 produto para aparecer no ranking de cotações.</StepSubtitle>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={() => setMode("upload")}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[#DBEAFE] bg-[#F5F7FB] p-5 text-left transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5">
          <BarChart2 size={22} />
          <p className="font-bold text-[#0F172A]">Importar planilha</p>
          <p className="text-xs text-slate-500">Upload de arquivo .xlsx com seu catálogo completo</p>
        </button>
        <button onClick={() => setMode("manual")}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[#DBEAFE] bg-[#F5F7FB] p-5 text-left transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5">
          <Pencil size={22} />
          <p className="font-bold text-[#0F172A]">Adicionar manualmente</p>
          <p className="text-xs text-slate-500">Preencha produto por produto</p>
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs text-[#2563EB]">
        <Lightbulb size={14} className="inline mr-1" />Baixe o{" "}
        <a
          href="/api/distributor/products/template"
          download="modelo-produtos-hubby.xlsx"
          className="font-bold underline"
        >
          modelo de planilha
        </a>{" "}
        para importação rápida
      </div>
      <SkipBtn onClick={onSkip} />
    </Card>
  );

  if (mode === "upload") return (
    <Card>
      <button onClick={() => setMode("choose")} className="mb-4 text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
      <StepTitle>Importar catálogo</StepTitle>
      <StepSubtitle>Selecione seu arquivo .xlsx com os produtos.</StepSubtitle>
      <a
        href="/api/distributor/products/template"
        download="modelo-produtos-hubby.xlsx"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline"
      >
        <Download size={14} className="inline mr-1" />Baixar modelo de planilha
      </a>
      <div className="mt-4">
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} />
        {!preview ? (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#DBEAFE] bg-[#F5F7FB] py-10 text-sm font-medium text-slate-500 transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5 disabled:opacity-50">
            {uploading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#22C55E] border-t-transparent" /> Processando…</> : <><FolderOpen size={20} className="inline mr-1" />Clique para selecionar o arquivo</>}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-5">
              <p className="font-bold text-[#0F172A]">Pré-visualização</p>
              <p className="mt-1 text-sm text-slate-500">
                <span className="text-green-700 font-medium">{preview.imported} novos produtos</span>
                {preview.ignored > 0 && <span className="text-slate-400"> · {preview.ignored} com erro</span>}
              </p>
            </div>

            {/* Lista visual dos produtos */}
            {preview.validRows.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Produtos para importação:</p>
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-[#DBEAFE] bg-white divide-y divide-slate-100">
                  {preview.validRows.map((row: any, i: number) => (
                    <div key={i} className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-[#F8FAFC]">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{row.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {row.brand} · {PACKAGING_LABELS[row.packaging_type] ?? row.packaging_type} {row.packaging_volume_ml}ml · {CATEGORY_LABELS[row.category] ?? row.category}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-slate-700">R$ {(row.price_cents / 100).toFixed(2)}</p>
                        <Badge variant={row.is_update ? "blue" : "green"} className="text-[9px] px-1 py-0 shadow-none font-bold uppercase">
                          {row.is_update ? "Atualizar" : "Novo"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de erros (se houver) */}
            {preview.errorsList.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
                  <AlertTriangle size={12} /> Erros encontrados na planilha (não serão importados):
                </p>
                <div className="max-h-32 overflow-y-auto rounded-2xl border border-red-100 bg-red-50/50 p-3 text-xs text-red-700 divide-y divide-red-100/50">
                  {preview.errorsList.map((err: any, i: number) => (
                    <div key={i} className="py-1 first:pt-0 last:pb-0">
                      <strong>Linha {err.row} (campo {err.field}):</strong> {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 flex gap-3">
              <PrimaryBtn loading={confirming} onClick={confirmImport} disabled={preview.validRows.length === 0}>
                Confirmar importação
              </PrimaryBtn>
              <button
                onClick={() => setPreview(null)}
                className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm font-medium text-slate-500 hover:bg-[#F5F7FB]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {uploadMsg && <p className="mt-3 text-sm text-red-600">{uploadMsg}</p>}
      </div>
      <SkipBtn onClick={onSkip} />
    </Card>
  );

  // Manual
  return (
    <Card>
      <button onClick={() => setMode("choose")} className="mb-4 text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
      <StepTitle>Adicionar produto</StepTitle>
      {savedCount > 0 && (
        <div className="mt-2 rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
          {savedCount} produto{savedCount !== 1 ? "s" : ""} adicionado{savedCount !== 1 ? "s" : ""}
        </div>
      )}
      <form onSubmit={handleManualSave} className="mt-5 space-y-3">
        <input required placeholder="Nome do produto" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
        <input required placeholder="Marca" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
          className="w-full rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none">
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <select value={form.packaging_type} onChange={e => setForm(f => ({ ...f, packaging_type: e.target.value }))}
            className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none">
            {PACKAGING_TYPES.map(p => <option key={p} value={p}>{PACKAGING_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input required type="number" min={1} placeholder="Volume (ml)" value={form.packaging_volume_ml}
            onChange={e => setForm(f => ({ ...f, packaging_volume_ml: Number(e.target.value) }))}
            className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
            <input required type="number" min={0.01} step={0.01} placeholder="0,00" value={form.price_cents || ""}
              onChange={e => setForm(f => ({ ...f, price_cents: Number(e.target.value) }))}
              className="w-full rounded-xl border border-[#DBEAFE] pl-9 pr-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
          </div>
        </div>
        {saveMsg && <p className={`text-sm font-medium ${saveMsg.startsWith("OK") ? "text-green-600" : "text-red-600"}`}>{saveMsg}</p>}
        <PrimaryBtn type="submit" loading={saving}>+ Adicionar produto</PrimaryBtn>
      </form>
      {savedCount > 0 && (
        <button onClick={onNext}
          className="mt-3 w-full rounded-xl border border-[#22C55E] py-3 text-sm font-bold text-[#22C55E] transition hover:bg-[#22C55E]/5">
          Continuar com {savedCount} produto{savedCount !== 1 ? "s" : ""} →
        </button>
      )}
      <SkipBtn onClick={onSkip} />
    </Card>
  );
}

// ─── Passo 3 — Regiões ────────────────────────────────────────────────────────

function Step3Regions({ token, state, onNext, onSkip }: {
  token: string | null; state: OnboardingState; onNext: () => void; onSkip: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "manual" | "upload">("choose");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [preview, setPreview] = useState<{ regions: unknown[]; summary: { imported: number; ignored: number } } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [form, setForm] = useState({
    city: "", state: "SP", delivery_days_business: 2,
    cutoff_time: "14:00", minimum_order_cents: 0,
    route_days: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(state.regions_count);
  const [saveMsg, setSaveMsg] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setUploadMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/distributor/delivery-regions/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setUploadMsg(data.error ?? "Erro no upload"); return; }
      setPreview({ regions: data.regions, summary: data.summary });
    } catch { setUploadMsg("Erro de conexão"); }
    finally { setUploading(false); }
  }

  async function confirmImport() {
    if (!token || !preview) return;
    setConfirming(true);
    const res = await apiFetch("/api/distributor/delivery-regions", {
      method: "POST", token,
      body: JSON.stringify({
        regions: (preview.regions as Array<{
          city: string; state: string; route_days: string[];
          delivery_days_business?: number; cutoff_time?: string; minimum_order_cents?: number;
        }>).map(r => ({
          city: r.city,
          state: r.state,
          delivery_days_business: r.delivery_days_business ?? 2,
          cutoff_time: r.cutoff_time ?? "14:00",
          minimum_order_cents: r.minimum_order_cents ?? 0,
          route_days: r.route_days,
        })),
      }),
    });
    setConfirming(false);
    if (res.ok) onNext();
    else {
      const d = await res.json();
      setUploadMsg(d.error ?? "Erro ao confirmar");
    }
  }

  async function handleManualSave(e: FormEvent) {
    e.preventDefault();
    if (!token || form.route_days.length === 0) { setSaveMsg("Selecione ao menos um dia de rota"); return; }
    setSaving(true);
    setSaveMsg("");
    const res = await apiFetch("/api/distributor/delivery-regions", {
      method: "POST", token,
      body: JSON.stringify({
        city: form.city, state: form.state.toUpperCase(),
        delivery_days_business: Number(form.delivery_days_business),
        cutoff_time: form.cutoff_time,
        minimum_order_cents: Number(form.minimum_order_cents) * 100,
        route_days: form.route_days,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const count = savedCount + 1;
      setSavedCount(count);
      setSaveMsg(`OK ${form.city}/${form.state} adicionada!`);
      setForm(f => ({ ...f, city: "", route_days: [] }));
    } else {
      const d = await res.json();
      setSaveMsg(d.error ?? "Erro ao salvar");
    }
  }

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      route_days: f.route_days.includes(day) ? f.route_days.filter(d => d !== day) : [...f.route_days, day],
    }));
  }

  if (mode === "choose") return (
    <Card>
      <StepTitle>Onde você entrega?</StepTitle>
      <StepSubtitle>Configure as regiões de entrega para aparecer no ranking dos compradores da sua área.</StepSubtitle>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={() => setMode("upload")}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[#DBEAFE] bg-[#F5F7FB] p-5 text-left transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5">
          <BarChart2 size={22} />
          <p className="font-bold text-[#0F172A]">Importar planilha de roteiro</p>
          <p className="text-xs text-slate-500">Formato com municípios e dias de rota</p>
        </button>
        <button onClick={() => setMode("manual")}
          className="flex flex-col items-start gap-2 rounded-2xl border-2 border-[#DBEAFE] bg-[#F5F7FB] p-5 text-left transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5">
          <Pencil size={22} />
          <p className="font-bold text-[#0F172A]">Adicionar cidade por cidade</p>
          <p className="text-xs text-slate-500">Preencha prazo, horário de corte e dias de rota</p>
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs text-[#2563EB]">
        <Lightbulb size={14} className="inline mr-1" />Baixe o{" "}
        <a
          href="/api/distributor/delivery-regions/template"
          download="modelo-roteiros-hubby.xlsx"
          className="font-bold underline"
        >
          modelo de planilha de roteiros
        </a>{" "}
        para importação rápida
      </div>
      <SkipBtn onClick={onSkip} />
    </Card>
  );

  if (mode === "upload") return (
    <Card>
      <button onClick={() => setMode("choose")} className="mb-4 text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
      <StepTitle>Importar roteiro</StepTitle>
      <a
        href="/api/distributor/delivery-regions/template"
        download="modelo-roteiros-hubby.xlsx"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#22C55E] hover:underline"
      >
        <Download size={14} className="inline mr-1" />Baixar modelo de planilha
      </a>
      <div className="mt-4">
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} />
        {!preview ? (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#DBEAFE] bg-[#F5F7FB] py-10 text-sm font-medium text-slate-500 transition hover:border-[#22C55E]/40 disabled:opacity-50">
            {uploading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#22C55E] border-t-transparent" />Processando…</> : <><FolderOpen size={20} className="inline mr-1" />Clique para selecionar</>}
          </button>
        ) : (
          <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-5">
            <p className="font-bold text-[#0F172A]">Pré-visualização</p>
            <p className="mt-1 text-sm text-slate-500">{preview.summary.imported} cidades encontradas · {preview.summary.ignored} ignoradas</p>
            <p className="mt-1 text-xs text-slate-400">Prazo padrão: 2 dias úteis · Corte: 14h — ajuste no perfil depois</p>
            <div className="mt-4 flex gap-3">
              <PrimaryBtn loading={confirming} onClick={confirmImport}>Confirmar importação</PrimaryBtn>
              <button onClick={() => setPreview(null)} className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm font-medium text-slate-500">Cancelar</button>
            </div>
          </div>
        )}
        {uploadMsg && <p className="mt-3 text-sm text-red-600">{uploadMsg}</p>}
      </div>
      <SkipBtn onClick={onSkip} />
    </Card>
  );

  return (
    <Card>
      <button onClick={() => setMode("choose")} className="mb-4 text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
      <StepTitle>Adicionar região</StepTitle>
      {savedCount > 0 && (
        <div className="mt-2 rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
          {savedCount} cidade{savedCount !== 1 ? "s" : ""} adicionada{savedCount !== 1 ? "s" : ""}
        </div>
      )}
      <form onSubmit={handleManualSave} className="mt-5 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <input required placeholder="Cidade" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            className="col-span-2 rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
          <input required placeholder="UF" maxLength={2} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
            className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Prazo (dias úteis)</label>
            <input type="number" min={1} max={30} value={form.delivery_days_business}
              onChange={e => setForm(f => ({ ...f, delivery_days_business: Number(e.target.value) }))}
              className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Horário de corte</label>
            <input type="time" value={form.cutoff_time} onChange={e => setForm(f => ({ ...f, cutoff_time: e.target.value }))}
              className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs text-slate-500">Dias de rota</label>
          <div className="flex gap-2 flex-wrap">
            {WEEK_DAYS.map(d => (
              <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${form.route_days.includes(d.value) ? "bg-[#22C55E] text-white" : "border border-[#DBEAFE] bg-[#F5F7FB] text-slate-500"}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {saveMsg && <p className={`text-sm font-medium ${saveMsg.startsWith("OK") ? "text-green-600" : "text-red-600"}`}>{saveMsg}</p>}
        <PrimaryBtn type="submit" loading={saving}>+ Adicionar cidade</PrimaryBtn>
      </form>
      {savedCount > 0 && (
        <button onClick={onNext}
          className="mt-3 w-full rounded-xl border border-[#22C55E] py-3 text-sm font-bold text-[#22C55E] transition hover:bg-[#22C55E]/5">
          Continuar com {savedCount} cidade{savedCount !== 1 ? "s" : ""} →
        </button>
      )}
      <SkipBtn onClick={onSkip} />
    </Card>
  );
}

// ─── Passo 4 — Crédito ────────────────────────────────────────────────────────

function Step4Credit({ token, state, onNext, onSkip }: {
  token: string | null; state: OnboardingState; onNext: () => void; onSkip: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "custom">("choose");
  const [score, setScore] = useState(state.credit_score_minimum);
  const [acceptRestrictions, setAcceptRestrictions] = useState(state.credit_accepts_restrictions);
  const [months, setMonths] = useState(state.credit_min_cnpj_months);
  const [saving, setSaving] = useState(false);

  async function handleSave(usePlatformDefault: boolean) {
    if (!token) return;
    setSaving(true);
    await apiFetch("/api/distributor/onboarding", {
      method: "PATCH", token,
      body: JSON.stringify({
        credit_score_minimum: usePlatformDefault ? 500 : score,
        credit_accepts_restrictions: usePlatformDefault ? false : acceptRestrictions,
        credit_min_cnpj_months: usePlatformDefault ? 6 : months,
      }),
    });
    setSaving(false);
    onNext();
  }

  if (mode === "choose") return (
    <Card>
      <StepTitle>Como você quer avaliar novos clientes?</StepTitle>
      <StepSubtitle>O sistema consulta automaticamente o bureau de crédito. Você define os critérios de aprovação.</StepSubtitle>
      <div className="mt-6 space-y-3">
        <button onClick={() => handleSave(true)} disabled={saving}
          className="flex w-full items-start gap-4 rounded-2xl border-2 border-[#DBEAFE] bg-[#F5F7FB] p-5 text-left transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5 disabled:opacity-50">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-white"><Check size={12} /></span>
          <div>
            <p className="font-bold text-[#0F172A]">Usar critério padrão da plataforma</p>
            <p className="mt-1 text-xs text-slate-500">Score ≥ 500 · CNPJ com no mínimo 6 meses · sem restrições graves</p>
          </div>
        </button>
        <button onClick={() => setMode("custom")}
          className="flex w-full items-start gap-4 rounded-2xl border-2 border-[#DBEAFE] bg-[#F5F7FB] p-5 text-left transition hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#DBEAFE] text-slate-400 text-xs">○</span>
          <div>
            <p className="font-bold text-[#0F172A]">Definir meu próprio critério</p>
            <p className="mt-1 text-xs text-slate-500">Configure score mínimo, tempo de CNPJ e tolerância a restrições</p>
          </div>
        </button>
      </div>
      <SkipBtn onClick={onSkip} />
    </Card>
  );

  return (
    <Card>
      <button onClick={() => setMode("choose")} className="mb-4 text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
      <StepTitle>Critério de crédito personalizado</StepTitle>
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-[#0F172A]">Score mínimo (0–1000)</label>
          <div className="mt-2 flex items-center gap-4">
            <input type="range" min={0} max={1000} step={50} value={score} onChange={e => setScore(Number(e.target.value))}
              className="flex-1 accent-[#22C55E]" />
            <span className="w-12 rounded-lg border border-[#DBEAFE] bg-[#F5F7FB] py-1 text-center text-sm font-bold text-[#0F172A]">{score}</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[#0F172A]">Tempo mínimo de CNPJ (meses)</label>
          <select value={months} onChange={e => setMonths(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none">
            {[0, 3, 6, 12, 24, 36].map(m => (
              <option key={m} value={m}>{m === 0 ? "Sem restrição" : `${m} meses`}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Aceitar clientes com restrições</p>
            <p className="text-xs text-slate-500">Pendências no Serasa/bureau</p>
          </div>
          <button type="button" onClick={() => setAcceptRestrictions(v => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${acceptRestrictions ? "bg-[#22C55E]" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${acceptRestrictions ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <PrimaryBtn loading={saving} onClick={() => handleSave(false)}>Salvar critério e continuar →</PrimaryBtn>
      </div>
    </Card>
  );
}

// ─── Passo 5 — Concluído ─────────────────────────────────────────────────────

function Step5Done({ state, onFinish }: { state: OnboardingState; onFinish: () => void }) {
  return (
    <Card>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#22C55E]/10">
          <Sparkles size={48} className="text-[#22C55E]" />
        </div>
        <h2 className="text-2xl font-display font-extrabold text-[#0F172A]">Tudo pronto!</h2>
        <p className="mt-2 text-sm text-slate-500">Seu perfil está configurado e ativo na plataforma.</p>
      </div>

      <div className="mt-6 space-y-2">
        {[
          { label: "Produtos cadastrados", value: `${state.products_count}`, ok: state.has_products },
          { label: "Regiões de entrega", value: `${state.regions_count}`, ok: state.has_regions },
          { label: "Critério de crédito", value: `Score ≥ ${state.credit_score_minimum}`, ok: true },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
            <span className="text-sm text-slate-600">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0F172A]">{item.value}</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${item.ok ? "bg-[#22C55E] text-white" : "bg-slate-200 text-slate-400"}`}>
                {item.ok ? <Check size={12} /> : "–"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!state.has_products && (
        <p className="mt-3 text-xs text-amber-600">
          <AlertTriangle size={12} className="inline mr-1" />Você ainda não tem produtos. Adicione pelo perfil para aparecer no ranking.
        </p>
      )}

      <div className="mt-8">
        <PrimaryBtn onClick={onFinish}>Ir para o painel →</PrimaryBtn>
      </div>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const role = (session?.user as { role?: string })?.role ?? "";

  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Redireciona se não for distribuidora
  useEffect(() => {
    if (status === "authenticated" && role && !["distributor_admin", "distributor_collaborator"].includes(role)) {
      router.replace("/");
    }
  }, [status, role, router]);

  // Carrega estado do onboarding
  useEffect(() => {
    if (!token) return;
    apiFetch("/api/distributor/onboarding", { method: "GET", token })
      .then(async r => {
        if (!r.ok) return;
        const data: OnboardingState = await r.json();
        if (data.onboarding_completed) {
          router.replace("/painel");
          return;
        }
        setOnboarding(data);
        setStep(data.onboarding_step);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, router]);

  // Persiste o passo atual
  async function saveStep(s: number) {
    if (!token) return;
    setStep(s);
    await apiFetch("/api/distributor/onboarding", {
      method: "PATCH", token, body: JSON.stringify({ step: s }),
    }).catch(() => {});
  }

  async function completeOnboarding() {
    if (!token) return;
    await apiFetch("/api/distributor/onboarding", {
      method: "PATCH", token, body: JSON.stringify({ completed: true, step: 5 }),
    }).catch(() => {});
    router.push("/painel");
  }

  async function refreshState() {
    if (!token) return;
    const r = await apiFetch("/api/distributor/onboarding", { method: "GET", token }).catch(() => null);
    if (r?.ok) {
      const data: OnboardingState = await r.json();
      setOnboarding(data);
    }
  }

  async function goNext() {
    await refreshState();
    const next = step + 1;
    await saveStep(next);
  }

  async function skipStep() {
    const next = step + 1;
    await saveStep(next);
  }

  if (loading || !onboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[#F5F7FB] px-4 py-12">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22C55E]">
          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="8" rx="1" fill="currentColor" opacity="0.9"/>
            <rect x="8" y="1" width="5" height="4" rx="1" fill="currentColor"/>
            <rect x="8" y="7" width="5" height="6" rx="1" fill="currentColor" opacity="0.7"/>
          </svg>
        </span>
        <span className="text-sm font-black uppercase tracking-[0.2em] text-[#0F172A]">HUBBY</span>
      </div>

      <div className="w-full max-w-xl">
        {step > 1 && step < 5 && <ProgressBar step={step} />}

        {step === 1 && (
          <Step1Welcome state={onboarding} onNext={() => saveStep(2)} />
        )}
        {step === 2 && (
          <Step2Products token={token} state={onboarding} onNext={goNext} onSkip={skipStep} />
        )}
        {step === 3 && (
          <Step3Regions token={token} state={onboarding} onNext={goNext} onSkip={skipStep} />
        )}
        {step === 4 && (
          <Step4Credit token={token} state={onboarding} onNext={goNext} onSkip={skipStep} />
        )}
        {step === 5 && (
          <Step5Done state={onboarding} onFinish={completeOnboarding} />
        )}
      </div>
    </div>
  );
}
