"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import {
  AlertTriangle, Download, FolderOpen, FileText, BarChart2,
  Pencil, Trash2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  category: string;
  brand: string;
  packaging_type: string;
  packaging_volume_ml: number;
  price_cents: number;
  available: boolean;
  image_url: string | null;
  image_source: "hubby_catalog" | "distributor_upload" | "none";
  price_updated_at: string;
  created_at: string;
};

type ProductForm = {
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  price_reais: string;
  available: boolean;
};

type BulkMode = "absolute" | "percent";

type NearExpiryOffer = {
  id: string;
  product_id: string;
  expires_at: string;
  discount_pct: number;
  stock: number;
  active: boolean;
  created_at: string;
  product: {
    id: string;
    name: string;
    brand: string;
    packaging_type: string;
    packaging_volume_ml: number;
    price_cents: number;
    image_url: string | null;
  };
};

type PriceRow = {
  product_id: string;
  name: string;
  brand: string;
  old_price_cents: number;
  new_price_cents: number;
  change_percent: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string }[] = [
  { value: "beer",       label: "Cerveja" },
  { value: "whisky",     label: "Whisky" },
  { value: "vodka",      label: "Vodka" },
  { value: "gin",        label: "Gin" },
  { value: "rum",        label: "Rum" },
  { value: "cachaca",    label: "Cachaça" },
  { value: "wine",       label: "Vinho" },
  { value: "sparkling",  label: "Espumante" },
  { value: "energy",     label: "Energético" },
  { value: "soft_drink", label: "Refrigerante" },
  { value: "water",      label: "Água" },
  { value: "juice",      label: "Suco" },
  { value: "other",      label: "Outro" },
];

const PACKAGING: { value: string; label: string }[] = [
  { value: "garrafa",  label: "Garrafa" },
  { value: "lata",     label: "Lata" },
  { value: "barril",   label: "Barril" },
  { value: "caixa",    label: "Caixa" },
  { value: "fardo",    label: "Fardo" },
  { value: "tetra_pak",label: "Tetra Pak" },
  { value: "other",    label: "Outro" },
];

const EMPTY_FORM: ProductForm = {
  name: "", brand: "", category: "beer",
  packaging_type: "garrafa", packaging_volume_ml: 600,
  price_reais: "", available: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

function packagingLabel(v: string) {
  return PACKAGING.find((p) => p.value === v)?.label ?? v;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SelectField({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", min, step, placeholder, required }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; min?: number; step?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        min={min} step={step} placeholder={placeholder} required={required}
        className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
      />
    </div>
  );
}

// ─── Popup de variação de preço ───────────────────────────────────────────────

function PricePopup({ changePercent, newPrice, onClose }: {
  changePercent: number; newPrice: string; onClose: () => void;
}) {
  const isRed = changePercent >= 15;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`w-full max-w-sm rounded-3xl p-6 shadow-xl ${isRed ? "bg-red-50 border border-red-200" : "bg-white border border-[#DBEAFE]"}`}>
        <p className={`text-base font-semibold ${isRed ? "text-red-800" : "text-[#0F172A]"}`}>
          {isRed ? <><AlertTriangle size={14} className="inline mr-1" />Variação alta de preço</> : "Preço atualizado"}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Novo preço: <strong>{newPrice}</strong>
        </p>
        <p className={`mt-1 text-sm font-semibold ${isRed ? "text-red-700" : "text-slate-600"}`}>
          Variação: {changePercent.toFixed(1)}%
          {isRed && " — variação acima de 15%"}
        </p>
        <button
          onClick={onClose}
          className={`mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white ${isRed ? "bg-red-600 hover:bg-red-700" : "bg-[#2563EB] hover:bg-[#1D4ED8]"}`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Modal de produto (criar/editar) ─────────────────────────────────────────

function ProductModal({ form, setForm, onSave, onClose, saving, title, error }: {
  form: ProductForm;
  setForm: (f: ProductForm) => void;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
  saving: boolean;
  title: string;
  error: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#0F172A]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextField label="Nome do produto *" value={form.name}
                onChange={(v) => setForm({ ...form, name: v })} required />
            </div>
            <TextField label="Marca *" value={form.brand}
              onChange={(v) => setForm({ ...form, brand: v })} required />
            <SelectField label="Categoria *" value={form.category}
              onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES} />
            <SelectField label="Embalagem *" value={form.packaging_type}
              onChange={(v) => setForm({ ...form, packaging_type: v })} options={PACKAGING} />
            <TextField label="Volume (ml) *" value={form.packaging_volume_ml}
              type="number" min={1} onChange={(v) => setForm({ ...form, packaging_volume_ml: Number(v) })} required />
            <div className="col-span-2">
              <TextField label="Preço (R$) *" value={form.price_reais}
                type="number" min={0.01} step="0.01" placeholder="Ex: 4.90"
                onChange={(v) => setForm({ ...form, price_reais: v })} required />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600">Disponível para venda</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, available: !form.available })}
                className={`relative h-6 w-11 rounded-full transition-colors ${form.available ? "bg-green-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.available ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-xs text-slate-500">{form.available ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar produto"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm font-medium text-slate-500 hover:bg-[#F5F7FB]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de importação de planilha ─────────────────────────────────────────

function ImportModal({ token, onClose, onImported }: {
  token: string | null; onClose: () => void; onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{ 
    imported: number; 
    ignored: number; 
    errors: number; 
    jobToken: string;
    validRows: any[];
    errorsList: any[];
  } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/distributor/products/import/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Erro no upload"); return; }
      setPreview({
        imported: data.summary?.new_count ?? 0,
        ignored: data.summary?.error_count ?? 0,
        errors: (data.errors ?? []).length,
        jobToken: data.token,
        validRows: data.valid_rows ?? [],
        errorsList: data.errors ?? [],
      });
    } catch { setMsg("Erro de conexão"); }
    finally { setUploading(false); }
  }

  async function confirm() {
    if (!preview || !token) return;
    setConfirming(true);
    const res = await apiFetch("/api/distributor/products/import/confirm", {
      method: "POST", 
      token, 
      body: JSON.stringify({ 
        token: preview.jobToken,
        products: preview.validRows,
      }),
    });
    setConfirming(false);
    if (res.ok) { onImported(); onClose(); }
    else { const d = await res.json(); setMsg(d.error ?? "Erro ao confirmar"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#0F172A]">Importar planilha</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <a href="/api/distributor/products/template" download="modelo-produtos-hubby.xlsx"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline">
          <Download size={14} className="inline mr-1" />Baixar modelo de planilha
        </a>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
        {!preview ? (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#DBEAFE] bg-[#F5F7FB] py-10 text-sm font-medium text-slate-500 hover:border-[#2563EB]/40 disabled:opacity-50">
            {uploading
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" /> Processando…</>
              : <><FolderOpen size={20} className="inline mr-1" />Clique para selecionar o arquivo .xlsx</>}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-4">
              <p className="font-semibold text-[#0F172A]">Resumo da planilha</p>
              <p className="mt-1 text-sm text-slate-600">
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
                          {row.brand} · {packagingLabel(row.packaging_type)} {row.packaging_volume_ml}ml · {categoryLabel(row.category)}
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
              <button onClick={confirm} disabled={confirming || preview.validRows.length === 0}
                className="flex-1 rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
                {confirming ? "Importando…" : "Confirmar importação"}
              </button>
              <button onClick={() => setPreview(null)}
                className="flex-1 rounded-xl border border-[#DBEAFE] py-2.5 text-sm text-slate-500 hover:bg-white">
                Cancelar
              </button>
            </div>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  );
}

// ─── Modal de atualização em lote ─────────────────────────────────────────────

function BulkUpdateModal({ count, onApply, onClose }: {
  count: number; onApply: (mode: BulkMode, value: number) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<BulkMode>("percent");
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = parseFloat(value);
    if (isNaN(n)) return;
    onApply(mode, n);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#0F172A]">Atualizar preço — {count} produto{count !== 1 ? "s" : ""}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <button type="button"
              onClick={() => setMode("percent")}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${mode === "percent" ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB]"}`}>
              % Percentual
            </button>
            <button type="button"
              onClick={() => setMode("absolute")}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${mode === "absolute" ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB]"}`}>
              R$ Valor fixo
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              {mode === "percent"
                ? "Variação percentual (ex: +10, -5)"
                : "Novo preço em reais (ex: 4.90)"}
            </label>
            <input
              type="number" step={mode === "percent" ? "0.1" : "0.01"}
              value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "percent" ? "Ex: 10 (para +10%) ou -5" : "Ex: 4.90"}
              required
              className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none"
            />
            {mode === "percent" && (
              <p className="text-xs text-slate-400">Positivo = aumento, negativo = desconto</p>
            )}
          </div>
          <div className="flex gap-3">
            <button type="submit"
              className="flex-1 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8]">
              Aplicar
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm text-slate-500 hover:bg-[#F5F7FB]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de importação de preços ───────────────────────────────────────────

function PriceImportModal({ token, onClose, onApplied }: {
  token: string; onClose: () => void; onApplied: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{
    matched: PriceRow[];
    skipped: number;
    highVariation: number;
  } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(""); setPreview(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/distributor/products/price-import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json() as {
        matched: PriceRow[];
        skipped: { row: number; reason: string }[];
        summary: { matched_count: number; skipped_count: number; high_variation_count: number };
        error?: string;
      };
      if (!res.ok) { setMsg(data.error ?? "Erro ao processar"); return; }
      setPreview({
        matched: data.matched,
        skipped: data.summary.skipped_count,
        highVariation: data.summary.high_variation_count,
      });
    } catch { setMsg("Erro de conexão"); }
    finally { setUploading(false); }
  }

  async function applyPrices() {
    if (!preview) return;
    setApplying(true);
    try {
      const res = await fetch("/api/distributor/products/price-import?confirm=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.matched }),
      });
      if (res.ok) { onApplied(); onClose(); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error ?? "Erro ao aplicar"); }
    } catch { setMsg("Erro de conexão"); }
    finally { setApplying(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#0F172A]">Importar preços em lote</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <a href="/api/distributor/products/price-template" download="modelo-precos-hubby.xlsx"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline">
          <Download size={14} className="inline mr-1" />Baixar modelo de planilha de preços
        </a>

        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />

        {!preview ? (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50 py-10 text-sm font-medium text-slate-500 hover:border-purple-400 disabled:opacity-50">
            {uploading
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" /> Processando…</>
              : <><FileText size={20} className="inline mr-1" />Clique para selecionar o arquivo .xlsx</>}
          </button>
        ) : (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            {/* Resumo */}
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-4">
              <p className="font-semibold text-[#0F172A]">Pré-visualização</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-700 font-medium">{preview.matched.length} produtos identificados</span>
                {preview.skipped > 0 && <span className="text-slate-400">{preview.skipped} não encontrados</span>}
                {preview.highVariation > 0 && (
                  <span className="font-semibold text-red-600"><AlertTriangle size={12} className="inline mr-1" />{preview.highVariation} com variação ≥ 15%</span>
                )}
              </div>
            </div>

            {/* Lista de preços */}
            <div className="overflow-y-auto flex-1 rounded-2xl border border-[#DBEAFE]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#F5F7FB]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Produto</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">Atual</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">Novo</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">Var.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBEAFE]">
                  {preview.matched.map((r) => (
                    <tr key={r.product_id} className={r.change_percent >= 15 ? "bg-red-50" : ""}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-[#0F172A]">{r.name}</p>
                        <p className="text-slate-400">{r.brand}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {formatBRL(r.old_price_cents)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#0F172A]">
                        {formatBRL(r.new_price_cents)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${r.change_percent >= 15 ? "text-red-600" : "text-slate-600"}`}>
                        {r.change_percent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={applyPrices} disabled={applying || preview.matched.length === 0}
                className="flex-1 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
                {applying ? "Aplicando…" : `Confirmar ${preview.matched.length} atualização${preview.matched.length !== 1 ? "ões" : ""}`}
              </button>
              <button onClick={() => setPreview(null)}
                className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm text-slate-500 hover:bg-[#F5F7FB]">
                Voltar
              </button>
            </div>
          </div>
        )}

        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProdutosPage() {
  useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAvailable, setFilterAvailable] = useState<"all" | "active" | "inactive">("all");

  // Seleção em lote
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Edição inline de preço
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [pricePopup, setPricePopup] = useState<{ changePercent: number; newPrice: string } | null>(null);

  // Modais
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showPriceImport, setShowPriceImport] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);

  // Form de produto
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Operações em andamento
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  // ─── Near-expiry offers ──────────────────────────────────────────────────────
  const [nearOffers, setNearOffers]       = useState<NearExpiryOffer[]>([]);
  const [nearLoading, setNearLoading]     = useState(true);
  const [nearSaving, setNearSaving]       = useState(false);
  const [nearError, setNearError]         = useState("");
  const [nearRemoving, setNearRemoving]   = useState<string | null>(null);
  const [nearForm, setNearForm]           = useState({
    product_id: "", expires_at: "", discount_pct: "", stock: "",
  });

  // ─── Carrega produtos ───────────────────────────────────────────────────────

  async function loadProducts() {
    if (!token) return;
    const params = new URLSearchParams({ limit: "500" });
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterAvailable !== "all") params.set("available", filterAvailable === "active" ? "true" : "false");
    if (search.trim()) params.set("q", search.trim());

    const res = await apiFetch(`/api/distributor/products?${params}`, { method: "GET", token });
    if (res.ok) {
      const data = await res.json() as { products: Product[] };
      setProducts(data.products ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (token) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterCategory, filterAvailable]);

  // Busca debounced
  useEffect(() => {
    const t = setTimeout(() => { if (token) loadProducts(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ─── Edição inline de preço ─────────────────────────────────────────────────

  async function commitPriceEdit(productId: string) {
    if (!token) return;
    const priceReais = parseFloat(editingPriceValue);
    if (isNaN(priceReais) || priceReais <= 0) { setEditingPriceId(null); return; }
    const priceCents = Math.round(priceReais * 100);

    const res = await apiFetch(`/api/distributor/products/${productId}`, {
      method: "PATCH", token, body: JSON.stringify({ price_cents: priceCents }),
    });
    if (res.ok) {
      const data = await res.json() as { product: Product; change_percent: number; popup_type: string };
      setProducts((prev) => prev.map((p) => p.id === productId ? data.product : p));
      if (data.popup_type !== "none") {
        setPricePopup({ changePercent: data.change_percent, newPrice: formatBRL(priceCents) });
      }
    }
    setEditingPriceId(null);
  }

  // ─── Toggle de disponibilidade ──────────────────────────────────────────────

  async function toggleAvailable(product: Product) {
    if (!token) return;
    setTogglingId(product.id);
    const res = await apiFetch(`/api/distributor/products/${product.id}`, {
      method: "PATCH", token, body: JSON.stringify({ available: !product.available }),
    });
    if (res.ok) {
      const data = await res.json() as { product: Product };
      setProducts((prev) => prev.map((p) => p.id === product.id ? data.product : p));
    }
    setTogglingId(null);
  }

  // ─── Salvar produto (criar ou editar) ───────────────────────────────────────

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setFormSaving(true); setFormError("");

    const priceReais = parseFloat(productForm.price_reais);
    if (isNaN(priceReais) || priceReais <= 0) {
      setFormError("Preço inválido"); setFormSaving(false); return;
    }

    const payload = {
      name: productForm.name,
      brand: productForm.brand,
      category: productForm.category,
      packaging_type: productForm.packaging_type,
      packaging_volume_ml: Number(productForm.packaging_volume_ml),
      price_cents: Math.round(priceReais * 100),
      available: productForm.available,
    };

    if (editingProduct) {
      const res = await apiFetch(`/api/distributor/products/${editingProduct.id}`, {
        method: "PATCH", token, body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json() as { product: Product };
        setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? data.product : p));
        setEditingProduct(null);
      } else {
        const d = await res.json(); setFormError(d.error ?? "Erro ao salvar");
      }
    } else {
      const res = await apiFetch("/api/distributor/products", {
        method: "POST", token, body: JSON.stringify(payload),
      });
      if (res.ok) {
        await loadProducts();
        setShowAdd(false);
        setProductForm(EMPTY_FORM);
      } else {
        const d = await res.json(); setFormError(d.error ?? "Erro ao criar");
      }
    }
    setFormSaving(false);
  }

  // ─── Excluir produto ────────────────────────────────────────────────────────

  async function deleteProduct(product: Product) {
    if (!token) return;
    setDeletingId(product.id);
    const res = await apiFetch(`/api/distributor/products/${product.id}`, { method: "DELETE", token });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setSelected((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }
    setDeletingId(null);
    setDeleteConfirm(null);
  }

  // ─── Near-expiry: carrega, cria, remove ─────────────────────────────────────

  async function loadNearOffers() {
    if (!token) return;
    setNearLoading(true);
    try {
      const res = await apiFetch("/api/near-expiry", { method: "GET", token });
      const data = await res.json() as { offers: NearExpiryOffer[] };
      setNearOffers(data.offers ?? []);
    } catch {}
    setNearLoading(false);
  }

  useEffect(() => { if (token) loadNearOffers(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createNearOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setNearSaving(true); setNearError("");
    const res = await apiFetch("/api/near-expiry", {
      method: "POST", token,
      body: JSON.stringify({
        product_id:   nearForm.product_id,
        expires_at:   nearForm.expires_at,
        discount_pct: Number(nearForm.discount_pct),
        stock:        Number(nearForm.stock),
      }),
    });
    if (res.ok) {
      const data = await res.json() as { offer: NearExpiryOffer };
      setNearOffers((prev) => [data.offer, ...prev]);
      setNearForm({ product_id: "", expires_at: "", discount_pct: "", stock: "" });
    } else {
      const d = await res.json() as { error?: string };
      setNearError(d.error ?? "Erro ao criar oferta");
    }
    setNearSaving(false);
  }

  async function removeNearOffer(id: string) {
    if (!token) return;
    setNearRemoving(id);
    const res = await apiFetch("/api/near-expiry", {
      method: "DELETE", token, body: JSON.stringify({ id }),
    });
    if (res.ok) setNearOffers((prev) => prev.filter((o) => o.id !== id));
    setNearRemoving(null);
  }

  // ─── Atualização em lote ────────────────────────────────────────────────────

  async function applyBulk(mode: BulkMode, value: number) {
    if (!token || selected.size === 0) return;
    setBulkApplying(true);
    setShowBulk(false);

    const targets = products.filter((p) => selected.has(p.id));

    await Promise.all(
      targets.map(async (p) => {
        let newCents: number;
        if (mode === "absolute") {
          newCents = Math.round(value * 100);
        } else {
          newCents = Math.round(p.price_cents * (1 + value / 100));
        }
        if (newCents <= 0) return;
        const res = await apiFetch(`/api/distributor/products/${p.id}`, {
          method: "PATCH", token, body: JSON.stringify({ price_cents: newCents }),
        });
        if (res.ok) {
          const data = await res.json() as { product: Product };
          setProducts((prev) => prev.map((q) => q.id === p.id ? data.product : q));
        }
      })
    );

    setSelected(new Set());
    setBulkApplying(false);
  }

  // ─── Seleção ────────────────────────────────────────────────────────────────

  const visibleIds = products.map((p) => p.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <button onClick={() => router.push("/painel")} className="mb-1 text-xs text-slate-400 hover:text-slate-600">
              ← Painel
            </button>
            <h1 className="text-2xl font-display font-semibold text-[#0F172A]">Gerenciar produtos</h1>
            <p className="text-sm text-slate-500">
              {products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/api/distributor/products/template" download="modelo-produtos-hubby.xlsx">
              <Button variant="outline" size="sm"><Download size={14} className="inline mr-1" />Baixar modelo</Button>
            </a>
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              <BarChart2 size={14} className="inline mr-1" />Importar catálogo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowPriceImport(true)}>
              <FileText size={14} className="inline mr-1" />Importar preços
            </Button>
            <Button size="sm" onClick={() => { setProductForm(EMPTY_FORM); setFormError(""); setShowAdd(true); }}>
              + Adicionar produto
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="search" placeholder="Buscar por nome ou marca…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-[#DBEAFE] px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none"
          />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none">
            <option value="all">Todas as categorias</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterAvailable} onChange={(e) => setFilterAvailable(e.target.value as "all" | "active" | "inactive")}
            className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        {/* Barra de seleção em lote */}
        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#2563EB] bg-[#EFF6FF] px-4 py-3">
            <span className="text-sm font-medium text-[#2563EB]">
              {selected.size} produto{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setShowBulk(true)} disabled={bulkApplying}
              className="rounded-xl bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
              {bulkApplying ? "Atualizando…" : "Atualizar preço selecionados"}
            </button>
            <button onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700">
              Limpar seleção
            </button>
          </div>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map((n) => (
              <div key={n} className="h-14 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-[#DBEAFE] bg-white px-6 py-16 text-center">
            <p className="text-slate-400">Nenhum produto encontrado.</p>
            <button onClick={() => { setProductForm(EMPTY_FORM); setShowAdd(true); }}
              className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">
              + Adicionar primeiro produto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DBEAFE] bg-[#F5F7FB]">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-4 w-4 rounded accent-[#2563EB]" />
                  </th>
                  <th className="w-12 px-2 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Nome / Marca</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Embalagem</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Preço</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Disponível</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Atualização</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBEAFE]">
                {products.map((p) => (
                  <tr key={p.id} className={`transition-colors ${!p.available ? "opacity-50" : ""} ${selected.has(p.id) ? "bg-[#EFF6FF]" : "hover:bg-[#F5F7FB]"}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                        className="h-4 w-4 rounded accent-[#2563EB]" />
                    </td>
                    <td className="px-2 py-2">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-10 w-10 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0F172A] leading-tight">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.brand}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="gray">{categoryLabel(p.category)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {packagingLabel(p.packaging_type)} {p.packaging_volume_ml}ml
                    </td>
                    {/* Preço editável inline */}
                    <td className="px-4 py-3 text-right">
                      {editingPriceId === p.id ? (
                        <input
                          type="number" step="0.01" min="0.01"
                          value={editingPriceValue}
                          autoFocus
                          onChange={(e) => setEditingPriceValue(e.target.value)}
                          onBlur={() => commitPriceEdit(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitPriceEdit(p.id);
                            if (e.key === "Escape") setEditingPriceId(null);
                          }}
                          className="w-24 rounded-lg border border-[#2563EB] px-2 py-1 text-right text-sm focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPriceId(p.id);
                            setEditingPriceValue((p.price_cents / 100).toFixed(2));
                          }}
                          title="Clique para editar o preço"
                          className="font-semibold text-[#0F172A] hover:text-[#2563EB] hover:underline cursor-pointer"
                        >
                          {formatBRL(p.price_cents)}
                        </button>
                      )}
                    </td>
                    {/* Toggle de disponibilidade */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAvailable(p)}
                        disabled={togglingId === p.id}
                        title={p.available ? "Clique para desativar" : "Clique para ativar"}
                        className={`relative inline-flex h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${p.available ? "bg-green-500" : "bg-slate-300"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${p.available ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">
                      {formatDate(p.price_updated_at)}
                    </td>
                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setProductForm({
                              name: p.name, brand: p.brand, category: p.category,
                              packaging_type: p.packaging_type,
                              packaging_volume_ml: p.packaging_volume_ml,
                              price_reais: (p.price_cents / 100).toFixed(2),
                              available: p.available,
                            });
                            setFormError("");
                          }}
                          className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-[#2563EB]"
                          title="Editar produto"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(p)}
                          disabled={deletingId === p.id}
                          className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Excluir produto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* ── Ofertas próximas do vencimento ──────────────────────────────── */}
        <div className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#0F172A]">Ofertas próximas do vencimento</h2>
            {nearOffers.filter((o) => o.active).length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                {nearOffers.filter((o) => o.active).length} ativa{nearOffers.filter((o) => o.active).length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Formulário nova oferta */}
          <div className="mb-6 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-[#0F172A]">Nova oferta</p>
            <form onSubmit={createNearOffer} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1 lg:col-span-2">
                <label className="text-xs font-medium text-slate-600">Produto *</label>
                <select
                  required
                  value={nearForm.product_id}
                  onChange={(e) => setNearForm({ ...nearForm, product_id: e.target.value })}
                  className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="">Selecione um produto…</option>
                  {products.filter((p) => p.available).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.brand} ({(p.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Data de vencimento *</label>
                <input
                  required type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={nearForm.expires_at}
                  onChange={(e) => setNearForm({ ...nearForm, expires_at: e.target.value })}
                  className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Desconto % *</label>
                <input
                  required type="number" min={0} max={99} step={1}
                  placeholder="Ex: 20"
                  value={nearForm.discount_pct}
                  onChange={(e) => setNearForm({ ...nearForm, discount_pct: e.target.value })}
                  className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Estoque disponível *</label>
                <input
                  required type="number" min={1}
                  placeholder="Ex: 50"
                  value={nearForm.stock}
                  onChange={(e) => setNearForm({ ...nearForm, stock: e.target.value })}
                  className="rounded-xl border border-[#DBEAFE] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                {nearError && (
                  <p className="mr-4 flex-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{nearError}</p>
                )}
                <button
                  type="submit" disabled={nearSaving}
                  className="ml-auto rounded-xl bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  {nearSaving ? "Salvando…" : "Criar oferta"}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de ofertas */}
          {nearLoading ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="h-16 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />
              ))}
            </div>
          ) : nearOffers.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma oferta cadastrada ainda.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#DBEAFE] bg-[#F5F7FB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Produto</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Vencimento</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Desconto</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Preço c/ desc.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Estoque</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBEAFE]">
                  {nearOffers.map((offer) => {
                    const daysLeft = Math.max(0, Math.ceil(
                      (new Date(offer.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    ));
                    const discountedCents = Math.round(
                      offer.product.price_cents * (1 - offer.discount_pct / 100)
                    );
                    return (
                      <tr key={offer.id} className={`transition-colors hover:bg-[#F5F7FB] ${!offer.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0F172A]">{offer.product.name}</p>
                          <p className="text-xs text-slate-400">{offer.product.brand}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${daysLeft <= 3 ? "bg-red-100 text-red-700" : daysLeft <= 7 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                            {daysLeft === 0 ? "Vence hoje" : `${daysLeft}d`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-green-600">
                          -{offer.discount_pct}%
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-[#0F172A]">
                          {(discountedCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{offer.stock} un</td>
                        <td className="px-4 py-3 text-center">
                          {offer.active
                            ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Ativa</span>
                            : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Removida</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          {offer.active && (
                            <button
                              onClick={() => removeNearOffer(offer.id)}
                              disabled={nearRemoving === offer.id}
                              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              {nearRemoving === offer.id ? "…" : <><Trash2 size={12} className="inline mr-1" />Remover</>}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de adicionar produto */}
      {showAdd && (
        <ProductModal
          form={productForm} setForm={setProductForm}
          onSave={saveProduct} onClose={() => setShowAdd(false)}
          saving={formSaving} title="Adicionar produto" error={formError}
        />
      )}

      {/* Modal de editar produto */}
      {editingProduct && (
        <ProductModal
          form={productForm} setForm={setProductForm}
          onSave={saveProduct} onClose={() => setEditingProduct(null)}
          saving={formSaving} title={`Editar — ${editingProduct.name}`} error={formError}
        />
      )}

      {/* Modal de importação de catálogo */}
      {showImport && (
        <ImportModal
          token={token}
          onClose={() => setShowImport(false)}
          onImported={loadProducts}
        />
      )}

      {/* Modal de importação de preços em lote */}
      {showPriceImport && token && (
        <PriceImportModal
          token={token}
          onClose={() => setShowPriceImport(false)}
          onApplied={loadProducts}
        />
      )}

      {/* Modal de atualização em lote */}
      {showBulk && (
        <BulkUpdateModal
          count={selected.size}
          onApply={applyBulk}
          onClose={() => setShowBulk(false)}
        />
      )}

      {/* Confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-display font-semibold text-[#0F172A]">Excluir produto?</h3>
            <p className="mt-2 text-sm text-slate-600">
              <strong>{deleteConfirm.name}</strong> será removido do catálogo e do ranking imediatamente.
            </p>
            <p className="mt-1 text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => deleteProduct(deleteConfirm)}
                disabled={deletingId === deleteConfirm.id}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deletingId === deleteConfirm.id ? "Excluindo…" : "Sim, excluir"}
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm text-slate-500 hover:bg-[#F5F7FB]">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de variação de preço */}
      {pricePopup && (
        <PricePopup
          changePercent={pricePopup.changePercent}
          newPrice={pricePopup.newPrice}
          onClose={() => setPricePopup(null)}
        />
      )}
    </div>
  );
}
