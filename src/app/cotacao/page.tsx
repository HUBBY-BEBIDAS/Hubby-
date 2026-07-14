"use client";

import { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ProductAutocomplete, formatPackaging } from "@/components/ui/ProductAutocomplete";
import type { ProductSearchResult } from "@/app/api/products/search/route";
import { MapPin, ChevronDown, Plus, Check } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Category =
  | "beer" | "whisky" | "vodka" | "gin" | "rum" | "cachaca"
  | "wine" | "sparkling" | "energy" | "soft_drink" | "water" | "juice" | "other";

type QuotationItem = {
  id: string;
  product_name: string;
  brand: string;
  category: Category;
  packaging: string;
  quantity: number;
};

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
  delivery_city: string;
  delivery_state: string;
  delivery_zip_code: string | null;
  client_plan: string;
  last_used_address_id: string | null;
  delivery_addresses: DeliveryAddress[];
};

type CepResult = {
  zip_code: string;
  city: string;
  state: string;
  street: string;
  district: string;
};

let idCounter = 1;
function newId() { return `item-${idCounter++}`; }

function formatZip(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ─── Componente de endereço ───────────────────────────────────────────────────

function AddressSection({
  token,
  profile,
  onProfileUpdate,
  selectedAddressId,
  onSelectAddress,
}: {
  token: string | null;
  profile: ClientProfile | null;
  onProfileUpdate: (patch: Partial<ClientProfile>) => void;
  selectedAddressId: string | null;
  onSelectAddress: (id: string | null) => void;
}) {
  const [mode, setMode] = useState<"idle" | "editing" | "selecting">("idle");
  const [cepInput, setCepInput] = useState("");
  const [cepLookup, setCepLookup] = useState<CepResult | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCepPrompt, setShowCepPrompt] = useState(false);

  // Mostra o prompt de CEP uma vez se não tiver zip salvo
  useEffect(() => {
    if (profile && !profile.delivery_zip_code) {
      setShowCepPrompt(true);
    }
  }, [profile?.delivery_zip_code]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPro = profile?.client_plan === "pro";
  const proAddresses = profile?.delivery_addresses ?? [];
  const hasMultiple = isPro && proAddresses.length > 1;

  // Endereço atualmente ativo
  const activeAddress: DeliveryAddress | null = (() => {
    if (!profile) return null;
    if (isPro && proAddresses.length > 0) {
      const byId = selectedAddressId ? proAddresses.find((a) => a.id === selectedAddressId) : null;
      const byLastUsed = profile.last_used_address_id ? proAddresses.find((a) => a.id === profile.last_used_address_id) : null;
      const defaultAddr = proAddresses.find((a) => a.is_default) ?? proAddresses[0];
      return byId ?? byLastUsed ?? defaultAddr;
    }
    return null;
  })();

  const displayCity  = activeAddress?.city  ?? profile?.delivery_city  ?? "";
  const displayState = activeAddress?.state ?? profile?.delivery_state ?? "";

  // ── Lookup de CEP ────────────────────────────────────────────────────────
  const lookupCep = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8 || !token) return;
    setCepLoading(true);
    setCepError("");
    setCepLookup(null);
    try {
      const res = await apiFetch(`/api/address/cep/${digits}`, { method: "GET", token });
      const data = await res.json() as CepResult & { error?: string };
      if (!res.ok) { setCepError(data.error ?? "CEP não encontrado"); return; }

      // Valida se a cidade do CEP é a mesma cidade cadastrada no perfil
      const normalizeName = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

      const profileCity = profile?.delivery_city ?? "";
      if (profileCity && normalizeName(data.city) !== normalizeName(profileCity)) {
        setCepError(
          `Este CEP pertence a "${data.city}", mas o seu endereço de entrega está cadastrado como "${profileCity}". ` +
          `O CEP deve pertencer à mesma cidade do seu cadastro. ` +
          `Você pode atualizar sua cidade em Perfil → Meu Perfil.`
        );
        setCepLookup(null);
        return;
      }

      setCepLookup(data);
    } catch {
      setCepError("Erro ao consultar CEP");
    } finally {
      setCepLoading(false);
    }
  }, [token, profile?.delivery_city]);

  useEffect(() => {
    const digits = cepInput.replace(/\D/g, "");
    if (digits.length === 8) { lookupCep(digits); }
    else { setCepLookup(null); setCepError(""); }
  }, [cepInput, lookupCep]);

  // ── Salvar CEP no perfil ──────────────────────────────────────────────────
  async function saveCepToProfile(result: CepResult) {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          delivery_zip_code:    result.zip_code,
          delivery_city:        result.city,
          delivery_state:       result.state,
          delivery_address_full: result.street
            ? `${result.street}${result.district ? ", " + result.district : ""}`
            : profile?.delivery_city ?? "",
        }),
      });
      onProfileUpdate({
        delivery_zip_code: result.zip_code,
        delivery_city:     result.city,
        delivery_state:    result.state,
      });
      setShowCepPrompt(false);
      setMode("idle");
      setCepInput("");
      setCepLookup(null);
    } catch {
      setCepError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="mb-6 h-16 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />
    );
  }

  return (
    <div className="mb-6">
      {/* Endereço ativo — sempre visível */}
      <div className="flex items-center justify-between rounded-2xl border border-[#DBEAFE] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin size={15} className="shrink-0 text-[#2563EB]" />
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Entregando em</p>
            <p className="text-sm font-semibold text-[#0F172A] leading-tight truncate">
              {displayCity}{displayState ? `, ${displayState}` : ""}
              {activeAddress?.zip_code && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  CEP {activeAddress.zip_code.slice(0, 5)}-{activeAddress.zip_code.slice(5)}
                </span>
              )}
              {!activeAddress && profile.delivery_zip_code && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  CEP {profile.delivery_zip_code.slice(0, 5)}-{profile.delivery_zip_code.slice(5)}
                </span>
              )}
            </p>
            {activeAddress?.label && (
              <p className="text-[11px] text-slate-400">{activeAddress.label}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMultiple && (
            <button
              onClick={() => setMode(mode === "selecting" ? "idle" : "selecting")}
              className="flex items-center gap-1 rounded-xl border border-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-[#F5F7FB]"
            >
              Trocar <ChevronDown size={12} className={`transition-transform ${mode === "selecting" ? "rotate-180" : ""}`} />
            </button>
          )}
          <button
            onClick={() => setMode(mode === "editing" ? "idle" : "editing")}
            className="text-xs font-medium text-[#2563EB] hover:underline"
          >
            Alterar
          </button>
        </div>
      </div>

      {/* Seletor de múltiplos endereços (Pro) */}
      {mode === "selecting" && hasMultiple && (
        <div className="mt-2 rounded-2xl border border-[#DBEAFE] bg-white shadow-sm overflow-hidden">
          {proAddresses.map((addr) => {
            const isActive = (selectedAddressId ?? profile.last_used_address_id ?? proAddresses.find((a) => a.is_default)?.id) === addr.id;
            return (
              <button
                key={addr.id}
                onClick={() => { onSelectAddress(addr.id); setMode("idle"); }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#F5F7FB] ${isActive ? "bg-[#EFF6FF]" : ""}`}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isActive ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300"}`}>
                  {isActive && <Check size={10} className="text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">{addr.label}</p>
                  <p className="text-xs text-slate-500 truncate">{addr.city}, {addr.state} · CEP {addr.zip_code.slice(0, 5)}-{addr.zip_code.slice(5)}</p>
                </div>
                {addr.is_default && (
                  <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">padrão</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Formulário de edição / troca de CEP */}
      {mode === "editing" && (
        <div className="mt-2 rounded-2xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold text-slate-600">Informar novo CEP de entrega</p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={cepInput}
              onChange={(e) => setCepInput(formatZip(e.target.value))}
              maxLength={9}
              className="flex-1 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
            />
            {cepLoading && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
              </div>
            )}
          </div>
          {cepError && <p className="mt-1.5 text-xs text-red-600">{cepError}</p>}
          {cepLookup && (
            <div className="mt-2 rounded-xl bg-[#EFF6FF] px-3 py-2.5">
              <p className="text-xs font-semibold text-[#0F172A]">{cepLookup.city}, {cepLookup.state}</p>
              {cepLookup.street && <p className="text-[11px] text-slate-500">{cepLookup.street}{cepLookup.district ? ", " + cepLookup.district : ""}</p>}
              <button
                onClick={() => saveCepToProfile(cepLookup)}
                disabled={saving}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {saving ? "Salvando…" : <><Check size={11} />Usar este endereço</>}
              </button>
            </div>
          )}
          <button
            onClick={() => { setMode("idle"); setCepInput(""); setCepLookup(null); setCepError(""); }}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Prompt de CEP (uma vez, se não tem zip) */}
      {showCepPrompt && mode === "idle" && (
        <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3">
          <Plus size={14} className="shrink-0 mt-0.5 text-[#2563EB]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#0F172A]">Qual o CEP do seu estabelecimento?</p>
            <p className="text-[11px] text-slate-500">Melhora a precisão das distribuidoras encontradas</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                value={cepInput}
                onChange={(e) => setCepInput(formatZip(e.target.value))}
                maxLength={9}
                className="w-32 rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
              />
              {cepLoading && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
                </div>
              )}
              {cepLookup && (
                <button
                  onClick={() => saveCepToProfile(cepLookup)}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
                >
                  {saving ? "…" : <><Check size={11} />Salvar</>}
                </button>
              )}
              <button
                onClick={() => { setShowCepPrompt(false); setCepInput(""); setCepLookup(null); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Agora não
              </button>
            </div>
            {cepError && <p className="mt-1 text-xs text-red-600">{cepError}</p>}
            {cepLookup && (
              <p className="mt-1 text-[11px] text-green-600 font-medium">
                <Check size={10} className="inline mr-0.5" />{cepLookup.city}, {cepLookup.state}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CotacaoPage() {
  useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();
  const quantityRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState<number | "">(1);
  const [maxDays, setMaxDays] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingActive, setCheckingActive] = useState(true);

  // Perfil do cliente (endereço)
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    // 1. Carrega o perfil do comprador
    apiFetch("/api/profile", { method: "GET", token })
      .then((r: Response) => r.json())
      .then((d: { profile?: ClientProfile }) => {
        if (d.profile) setProfile(d.profile);
      })
      .catch(() => {});

    // 2. Verifica se existe alguma cotação em aberto (e que não tenha pedidos enviados)
    apiFetch("/api/quotations?status=open", { method: "GET", token })
      .then((r: Response) => r.json())
      .then((d: { quotations?: any[] }) => {
        if (d.quotations && d.quotations.length > 0) {
          const activeQuotation = d.quotations.find((q) => !q.orders || q.orders.length === 0);
          if (activeQuotation) {
            router.replace(`/cotacao/${activeQuotation.id}`);
            return;
          }
        }
        setCheckingActive(false);
      })
      .catch(() => {
        setCheckingActive(false);
      });
  }, [token, router]);

  function handleProductSelect(result: ProductSearchResult) {
    setSelectedProduct(result);
    setSearchValue("");
    setTimeout(() => quantityRef.current?.focus(), 0);
  }

  function clearSelection() {
    setSelectedProduct(null);
    setSearchValue("");
    setQuantity(1);
  }

  function addItem(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    const parsedQty = typeof quantity === "number" ? quantity : parseInt(quantity) || 1;
    const qty = Math.max(1, parsedQty);
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        product_name: selectedProduct.name,
        brand: selectedProduct.brand,
        category: selectedProduct.category as Category,
        packaging: formatPackaging(selectedProduct.packaging_type, selectedProduct.packaging_volume_ml),
        quantity: qty,
      },
    ]);
    clearSelection();
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQuantity(id: string, qty: number) {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  }

  async function submitQuotation() {
    if (items.length === 0) { setError("Adicione ao menos um produto."); return; }
    setError("");
    if (!token) { setError("Sessão expirada. Faça login novamente."); return; }
    setLoading(true);

    const body: Record<string, unknown> = {
      items: items.map(({ product_name, brand, category, packaging, quantity }) => ({
        product_name, brand, category, packaging, quantity,
      })),
      max_delivery_days: maxDays !== "" ? Number(maxDays) : null,
    };

    // Pro: envia o endereço selecionado
    const isPro = profile?.client_plan === "pro";
    const proAddresses = profile?.delivery_addresses ?? [];
    if (isPro && proAddresses.length > 0) {
      const active = selectedAddressId
        ?? profile?.last_used_address_id
        ?? proAddresses.find((a) => a.is_default)?.id
        ?? proAddresses[0]?.id;
      if (active) body.delivery_address_id = active;
    }

    const res = await apiFetch("/api/quotations", { method: "POST", token, body: JSON.stringify(body) });
    const data = await res.json() as { quotation?: { id: string }; error?: string };
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Erro ao criar cotação."); return; }
    router.push(`/cotacao/${data.quotation!.id}/ranking`);
  }

  if (checkingActive) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent mb-3" />
          <p className="text-sm font-semibold text-slate-500">Verificando cotação ativa...</p>
        </main>
      </div>
    );
  }

  const packagingLabel = selectedProduct
    ? formatPackaging(selectedProduct.packaging_type, selectedProduct.packaging_volume_ml)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">
          Nova Cotação
        </h1>
        <p className="mb-6 text-sm font-medium text-slate-500">
          Busque e adicione os produtos que deseja cotar. Depois clique em{" "}
          <strong>Ver ranking de preços</strong>.
        </p>

        {/* Endereço de entrega — automático */}
        <AddressSection
          token={token}
          profile={profile}
          onProfileUpdate={(patch) => setProfile((p) => p ? { ...p, ...patch } : p)}
          selectedAddressId={selectedAddressId}
          onSelectAddress={setSelectedAddressId}
        />

        {/* Formulário de adição */}
        <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-[11px] font-bold tracking-widest uppercase text-slate-400">
            Adicionar produto
          </h2>

          <form onSubmit={addItem} className="flex flex-col gap-4">
            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-xl border border-[#DBEAFE] bg-[#F0FDF4] px-4 py-3">
                <div>
                  <p className="font-bold text-[#0F172A]">{selectedProduct.name}</p>
                  <p className="text-xs text-[#22C55E]">
                    {selectedProduct.brand} · {packagingLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="ml-4 text-slate-400 hover:text-[#22C55E]"
                  aria-label="Remover seleção"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <ProductAutocomplete
                token={token}
                value={searchValue}
                onChange={setSearchValue}
                onSelect={handleProductSelect}
                onClear={() => setSearchValue("")}
              />
            )}

            {selectedProduct && (
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Input
                    label="Quantidade"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setQuantity("");
                      } else {
                        const num = Number(val);
                        setQuantity(isNaN(num) ? "" : num);
                      }
                    }}
                    required
                    ref={quantityRef}
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm" className="mb-0.5">
                  + Adicionar
                </Button>
              </div>
            )}

            {!selectedProduct && (
              <p className="text-xs text-slate-400">
                Digite ao menos 2 letras para buscar produtos disponíveis.
              </p>
            )}
          </form>
        </div>

        {/* Lista de itens adicionados */}
        {items.length > 0 && (
          <div className="mb-6 rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#DBEAFE] px-6 py-3">
              <h2 className="text-sm font-bold text-[#0F172A]">Produtos da cotação</h2>
              <span className="text-xs text-slate-400">{items.length} produto(s)</span>
            </div>

            <ul className="divide-y divide-[#DBEAFE]">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{item.product_name}</p>
                    <p className="text-xs text-slate-400">{item.brand} · {item.packaging}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB]"
                    >−</button>
                    <span className="w-10 text-center text-sm font-medium text-[#0F172A]">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB]"
                    >+</button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="ml-2 text-slate-300 hover:text-red-500"
                    aria-label="Remover"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Prazo máximo + ação */}
        <div className="rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <Input
            label="Prazo máximo de entrega (dias úteis)"
            type="number"
            min={1}
            max={90}
            value={maxDays}
            onChange={(e) => setMaxDays(e.target.value === "" ? "" : Number(e.target.value))}
            hint="Opcional — distribuidoras fora do prazo aparecem esmaecidas no ranking"
            placeholder="ex: 5"
          />

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={submitQuotation}
            loading={loading}
            disabled={items.length === 0}
            className="mt-4"
          >
            Ver ranking de preços{items.length > 0 ? ` — ${items.length} produto(s)` : ""}
          </Button>
        </div>
      </main>
    </div>
  );
}
