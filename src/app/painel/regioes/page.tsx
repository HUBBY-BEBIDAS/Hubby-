"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Download, FolderOpen, FileText, MapPin } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FreightType = "free" | "fixed" | "by_weight" | "by_value" | "custom";

type DeliveryRegion = {
  id: string;
  city: string;
  state: string;
  delivery_days_business: number;
  route_days: string[];
  cutoff_time: string;
  minimum_order_cents: number;
  freight_type: FreightType;
  freight_value_cents: number | null;
  free_freight_above_cents: number | null;
  freight_notes: string | null;
};

type RegionForm = {
  city: string;
  state: string;
  delivery_days_business: number;
  route_days: string[];
  cutoff_time: string;
  minimum_order_reais: string;
  freight_type: FreightType;
  freight_value_reais: string;
  free_freight_above_reais: string;
  freight_notes: string;
};

type ImportPreview = {
  city: string;
  state: string;
  route_days: string[];
  is_update: boolean;
  change_type: "new" | "update" | "no_change";
  old_route_days: string[];
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROUTE_DAYS = [
  { value: "monday",    label: "Seg" },
  { value: "tuesday",   label: "Ter" },
  { value: "wednesday", label: "Qua" },
  { value: "thursday",  label: "Qui" },
  { value: "friday",    label: "Sex" },
  { value: "saturday",  label: "Sáb" },
  { value: "sunday",    label: "Dom" },
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const EMPTY_FORM: RegionForm = {
  city: "",
  state: "SP",
  delivery_days_business: 2,
  route_days: ["monday", "wednesday", "friday"],
  cutoff_time: "14:00",
  minimum_order_reais: "0",
  freight_type: "free",
  freight_value_reais: "",
  free_freight_above_reais: "",
  freight_notes: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function routeDaysLabel(days: string[]) {
  const map: Record<string, string> = {
    monday: "Seg", tuesday: "Ter", wednesday: "Qua",
    thursday: "Qui", friday: "Sex", saturday: "Sáb", sunday: "Dom",
  };
  if (!days || days.length === 0) return "—";
  return days.map((d) => map[d] ?? d).join(", ");
}

function freightLabel(r: DeliveryRegion): string {
  if (r.freight_type === "free") return "Grátis";
  if (r.freight_type === "fixed" && r.freight_value_cents != null)
    return `R$ ${(r.freight_value_cents / 100).toFixed(2).replace(".", ",")}`;
  if (r.freight_type === "by_value" && r.free_freight_above_cents != null)
    return `Grátis acima de ${formatBRL(r.free_freight_above_cents)}`;
  if (r.freight_type === "by_weight") return "Por peso";
  return "A combinar";
}

function freightBadgeClass(type: FreightType): string {
  if (type === "free") return "bg-green-100 text-green-700";
  if (type === "fixed") return "bg-blue-100 text-blue-700";
  if (type === "by_value") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function formToPayload(f: RegionForm) {
  return {
    city: f.city.trim(),
    state: f.state.toUpperCase(),
    delivery_days_business: f.delivery_days_business,
    route_days: f.route_days,
    cutoff_time: f.cutoff_time,
    minimum_order_cents: Math.round(parseFloat(f.minimum_order_reais || "0") * 100),
    freight_type: f.freight_type,
    freight_value_cents:
      f.freight_type === "fixed" && f.freight_value_reais
        ? Math.round(parseFloat(f.freight_value_reais) * 100)
        : undefined,
    free_freight_above_cents:
      f.freight_type === "by_value" && f.free_freight_above_reais
        ? Math.round(parseFloat(f.free_freight_above_reais) * 100)
        : undefined,
    freight_notes: f.freight_notes.trim() || undefined,
  };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

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

function RouteDaysPicker({ value, onChange }: {
  value: string[]; onChange: (v: string[]) => void;
}) {
  function toggle(day: string) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">Dias de rota</label>
      <div className="flex flex-wrap gap-2">
        {ROUTE_DAYS.map((d) => {
          const active = value.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => toggle(d.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-[#2563EB] text-white"
                  : "border border-[#DBEAFE] bg-white text-slate-500 hover:bg-[#F5F7FB]"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal de região (criar/editar) ──────────────────────────────────────────

function RegionModal({ form, setForm, onSave, onClose, saving, title, error }: {
  form: RegionForm;
  setForm: (f: RegionForm) => void;
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
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextField label="Cidade *" value={form.city}
                onChange={(v) => setForm({ ...form, city: v })} required placeholder="Ex: São Paulo" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Estado *</label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
              >
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <TextField label="Prazo (dias úteis) *" value={form.delivery_days_business}
              type="number" min={1}
              onChange={(v) => setForm({ ...form, delivery_days_business: Number(v) })} required />
            <TextField label="Horário de corte *" value={form.cutoff_time}
              placeholder="Ex: 14:00"
              onChange={(v) => setForm({ ...form, cutoff_time: v })} required />
            <TextField label="Pedido mínimo (R$)" value={form.minimum_order_reais}
              type="number" min={0} placeholder="0"
              onChange={(v) => setForm({ ...form, minimum_order_reais: v })} />
          </div>
          <RouteDaysPicker value={form.route_days} onChange={(v) => setForm({ ...form, route_days: v })} />

          {/* Frete */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-600">Como você cobra o frete nesta região?</label>
            <div className="grid grid-cols-1 gap-2">
              {([
                { value: "free",      label: "Frete grátis sempre" },
                { value: "fixed",     label: "Frete fixo" },
                { value: "by_value",  label: "Frete grátis acima de um valor" },
                { value: "by_weight", label: "Calculado por peso/volume" },
                { value: "custom",    label: "Definido na negociação" },
              ] as { value: FreightType; label: string }[]).map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#DBEAFE] px-3 py-2.5 hover:bg-[#F5F7FB] has-[:checked]:border-[#2563EB] has-[:checked]:bg-[#EFF6FF]">
                  <input
                    type="radio"
                    name="freight_type"
                    value={opt.value}
                    checked={form.freight_type === opt.value}
                    onChange={() => setForm({ ...form, freight_type: opt.value })}
                    className="accent-[#2563EB]"
                  />
                  <span className="text-sm text-[#0F172A]">{opt.label}</span>
                </label>
              ))}
            </div>

            {form.freight_type === "fixed" && (
              <TextField label="Valor do frete (R$)" value={form.freight_value_reais}
                type="number" min={0} step="0.01" placeholder="Ex: 25.00"
                onChange={(v) => setForm({ ...form, freight_value_reais: v })} />
            )}
            {form.freight_type === "by_value" && (
              <TextField label="Frete grátis para pedidos acima de (R$)" value={form.free_freight_above_reais}
                type="number" min={0} step="0.01" placeholder="Ex: 500.00"
                onChange={(v) => setForm({ ...form, free_freight_above_reais: v })} />
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Observações de frete (opcional)</label>
              <textarea
                value={form.freight_notes}
                onChange={(e) => setForm({ ...form, freight_notes: e.target.value })}
                placeholder="Ex: Frete grátis acima de R$ 500 para SP capital"
                rows={2}
                maxLength={500}
                className="rounded-xl border border-[#DBEAFE] px-3 py-2 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none resize-none"
              />
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar região"}
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

// ─── Modal de importação ──────────────────────────────────────────────────────

function ImportModal({ token, onClose, onImported }: {
  token: string | null; onClose: () => void; onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{
    regions: ImportPreview[];
    jobToken: string;
    summary: {
      total_cities: number;
      new_cities: number;
      updated_cities: number;
      no_change_cities: number;
      out_of_route_cities: number;
    };
  } | null>(null);

  async function downloadTemplate() {
    if (!token) return;
    const res = await fetch("/api/distributor/delivery-regions/template", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "modelo-roteiros-hubby.xlsx";
    a.click();
    URL.revokeObjectURL(href);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true); setMsg(""); setPreview(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/distributor/delivery/import/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json() as {
        token: string;
        summary: {
          total_cities: number;
          new_cities: number;
          updated_cities: number;
          no_change_cities: number;
          out_of_route_cities: number;
          error_count: number;
        };
        valid_rows: ImportPreview[];
        error?: string;
      };
      if (!res.ok) { setMsg(data.error ?? "Erro ao processar"); return; }
      setPreview({
        regions: data.valid_rows,
        jobToken: data.token,
        summary: data.summary
      });
    } catch { setMsg("Erro de conexão"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function confirm() {
    if (!preview || !token) return;
    setConfirming(true);
    try {
      const res = await apiFetch("/api/distributor/delivery/import/confirm", {
        method: "POST",
        token,
        body: JSON.stringify({ token: preview.jobToken }),
      });
      if (res.ok) { onImported(); onClose(); }
      else {
        const d = await res.json() as { error?: string };
        setMsg(d.error ?? "Erro ao salvar");
      }
    } catch { setMsg("Erro de conexão"); }
    finally { setConfirming(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-[#0F172A]">Importar regiões via planilha</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <button
          type="button"
          onClick={downloadTemplate}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline"
        >
          <Download size={14} className="inline mr-1" />Baixar planilha modelo
        </button>

        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />

        {!preview ? (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 py-10 text-sm font-medium text-slate-500 hover:border-blue-400 disabled:opacity-50">
            {uploading
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> Processando…</>
              : <><FolderOpen size={20} className="inline mr-1" />Clique para selecionar o arquivo .xlsx</>}
          </button>
        ) : (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] p-4 text-xs">
              <p className="font-semibold text-sm text-[#0F172A] mb-2">Pré-visualização</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600">
                <div>Total: <span className="font-bold text-[#0F172A]">{preview.summary.total_cities} cidades</span></div>
                <div>Novas rotas: <span className="font-bold text-green-700">+{preview.summary.new_cities}</span></div>
                <div>Alteradas: <span className="font-bold text-amber-700">{preview.summary.updated_cities}</span></div>
                <div>Sem alterações: <span className="font-bold text-slate-500">{preview.summary.no_change_cities}</span></div>
                <div className="col-span-2">Fora de rota (serão removidas): <span className="font-bold text-red-700">{preview.summary.out_of_route_cities}</span></div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 rounded-2xl border border-[#DBEAFE]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#F5F7FB]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Município</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-500">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Roteiro (Dias de entrega)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBEAFE]">
                  {preview.regions.map((r, i) => {
                    let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
                    let statusLabel = routeDaysLabel(r.route_days);
                    
                    if (r.route_days.length === 0) {
                      badgeColor = "bg-red-50 text-red-700 border-red-200";
                      statusLabel = "Fora de rota";
                    } else if (r.change_type === "new") {
                      badgeColor = "bg-green-50 text-green-700 border-green-200";
                      statusLabel = "Novo";
                    } else if (r.change_type === "update") {
                      badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                      statusLabel = "Alterado";
                    }

                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-[#0F172A]">
                          {r.city} — {r.state}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badgeColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {r.change_type === "update" ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-slate-400 line-through">De: {routeDaysLabel(r.old_route_days)}</span>
                              <span className="text-[#0F172A] font-medium">Para: {routeDaysLabel(r.route_days)}</span>
                            </div>
                          ) : r.change_type === "new" ? (
                            routeDaysLabel(r.route_days)
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={confirm} disabled={confirming || preview.regions.length === 0}
                className="flex-1 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
                {confirming ? "Salvando…" : "Confirmar importação"}
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

export default function RegioesPage() {
  useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modais
  const [showAdd, setShowAdd] = useState(false);
  const [editingRegion, setEditingRegion] = useState<DeliveryRegion | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeliveryRegion | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Form
  const [regionForm, setRegionForm] = useState<RegionForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Operações em andamento
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Carrega regiões ──────────────────────────────────────────────────────

  async function loadRegions() {
    if (!token) return;
    const res = await apiFetch("/api/distributor/delivery-regions", { method: "GET", token });
    if (res.ok) {
      const data = await res.json() as { regions: DeliveryRegion[] };
      setRegions(data.regions ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (token) loadRegions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ─── Filtro client-side ───────────────────────────────────────────────────

  const filtered = regions.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return r.city.toLowerCase().includes(q) || r.state.toLowerCase().includes(q);
  });

  // ─── Salvar (criar / editar) ──────────────────────────────────────────────

  async function saveRegion(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setFormSaving(true); setFormError("");
    const payload = formToPayload(regionForm);

    try {
      let res: Response;
      if (editingRegion) {
        res = await apiFetch(`/api/distributor/delivery-regions/${editingRegion.id}`, {
          method: "PATCH", token, body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/distributor/delivery-regions", {
          method: "POST", token, body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json() as { region: DeliveryRegion };
        if (editingRegion) {
          setRegions((prev) => prev.map((r) => r.id === editingRegion.id ? data.region : r));
        } else {
          setRegions((prev) => [...prev, data.region].sort((a, b) =>
            a.state.localeCompare(b.state) || a.city.localeCompare(b.city)
          ));
        }
        setShowAdd(false);
        setEditingRegion(null);
        setRegionForm(EMPTY_FORM);
      } else {
        const d = await res.json() as { error?: string };
        setFormError(d.error ?? "Erro ao salvar");
      }
    } catch { setFormError("Erro de conexão"); }
    finally { setFormSaving(false); }
  }

  // ─── Deletar ──────────────────────────────────────────────────────────────

  async function deleteRegion(region: DeliveryRegion) {
    if (!token) return;
    setDeletingId(region.id);
    try {
      const res = await apiFetch(`/api/distributor/delivery-regions/${region.id}`, {
        method: "DELETE", token,
      });
      if (res.ok) {
        setRegions((prev) => prev.filter((r) => r.id !== region.id));
        setDeleteConfirm(null);
      }
    } catch { /* silencioso */ }
    finally { setDeletingId(null); }
  }

  // ─── Abrir modal de edição ────────────────────────────────────────────────

  function openEdit(region: DeliveryRegion) {
    setEditingRegion(region);
    setRegionForm({
      city: region.city,
      state: region.state,
      delivery_days_business: region.delivery_days_business,
      route_days: region.route_days,
      cutoff_time: region.cutoff_time,
      minimum_order_reais: (region.minimum_order_cents / 100).toFixed(2),
      freight_type: region.freight_type ?? "free",
      freight_value_reais: region.freight_value_cents != null
        ? (region.freight_value_cents / 100).toFixed(2)
        : "",
      free_freight_above_reais: region.free_freight_above_cents != null
        ? (region.free_freight_above_cents / 100).toFixed(2)
        : "",
      freight_notes: region.freight_notes ?? "",
    });
    setFormError("");
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">

        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push("/painel")}
              className="mb-1 text-xs text-slate-400 hover:text-slate-600"
            >
              ← Voltar ao painel
            </button>
            <h1 className="text-2xl font-display font-semibold text-[#0F172A]">Regiões e rotas</h1>
            <p className="text-sm text-slate-500">{regions.length} município{regions.length !== 1 ? "s" : ""} cadastrado{regions.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              <FileText size={14} className="inline mr-1" />Importar planilha
            </Button>
            <Button size="sm" onClick={() => { setShowAdd(true); setEditingRegion(null); setRegionForm(EMPTY_FORM); setFormError(""); }}>
              + Adicionar região
            </Button>
          </div>
        </div>

        {/* Filtro */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cidade ou estado…"
            className="w-full max-w-xs rounded-xl border border-[#DBEAFE] bg-white px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
          />
        </div>

        {/* Tabela */}
        <div className="rounded-3xl border border-[#DBEAFE] bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <MapPin size={36} className="text-slate-300" />
              <p className="text-sm">
                {search ? "Nenhuma região encontrada para esta busca" : "Nenhuma região cadastrada ainda"}
              </p>
              {!search && (
                <Button size="sm" onClick={() => { setShowAdd(true); setRegionForm(EMPTY_FORM); setFormError(""); }}>
                  + Adicionar primeira região
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#DBEAFE] bg-[#F5F7FB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Município</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">UF</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Prazo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Corte</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Dias de rota</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Mín. pedido</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Frete</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBEAFE]">
                  {filtered.map((region) => (
                    <tr key={region.id} className="hover:bg-[#F5F7FB] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#0F172A]">{region.city}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-lg bg-[#DBEAFE] px-2 py-0.5 text-xs font-semibold text-[#1D4ED8]">
                          {region.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {region.delivery_days_business}d úteis
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {region.cutoff_time}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {routeDaysLabel(region.route_days)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">
                        {region.minimum_order_cents > 0 ? formatBRL(region.minimum_order_cents) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${freightBadgeClass(region.freight_type ?? "free")}`}>
                          {freightLabel(region)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(region)}
                            className="rounded-lg border border-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#F5F7FB]"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(region)}
                            disabled={deletingId === region.id}
                            className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40"
                          >
                            {deletingId === region.id ? "…" : "Remover"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resumo rodapé */}
        {filtered.length > 0 && (
          <p className="mt-3 text-xs text-slate-400 text-right">
            {filtered.length} de {regions.length} região{regions.length !== 1 ? "ões" : ""}
          </p>
        )}
      </main>

      {/* Modal Adicionar */}
      {showAdd && !editingRegion && (
        <RegionModal
          form={regionForm}
          setForm={setRegionForm}
          onSave={saveRegion}
          onClose={() => { setShowAdd(false); setFormError(""); }}
          saving={formSaving}
          title="Adicionar região"
          error={formError}
        />
      )}

      {/* Modal Editar */}
      {editingRegion && (
        <RegionModal
          form={regionForm}
          setForm={setRegionForm}
          onSave={saveRegion}
          onClose={() => { setEditingRegion(null); setFormError(""); }}
          saving={formSaving}
          title={`Editar — ${editingRegion.city} / ${editingRegion.state}`}
          error={formError}
        />
      )}

      {/* Modal Confirmar exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <p className="text-base font-semibold text-[#0F172A]">Remover região?</p>
            <p className="mt-2 text-sm text-slate-500">
              <strong>{deleteConfirm.city} — {deleteConfirm.state}</strong> será removida do seu roteiro.
              Cotações em andamento não serão afetadas.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => deleteRegion(deleteConfirm)}
                disabled={deletingId === deleteConfirm.id}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingId === deleteConfirm.id ? "Removendo…" : "Remover"}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-[#DBEAFE] py-3 text-sm text-slate-500 hover:bg-[#F5F7FB]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de importação */}
      {showImport && (
        <ImportModal
          token={token}
          onClose={() => setShowImport(false)}
          onImported={() => { loadRegions(); }}
        />
      )}
    </div>
  );
}
