"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ProductDetailModal, type ProductModalData } from "@/components/ProductDetailModal";
import { Heart, ShoppingCart, Trash2, Search } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type WishlistItem = {
  id: string;
  product_key: string;
  product_name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  image_url: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PACKAGING_LABEL: Record<string, string> = {
  garrafa: "Garrafa", lata: "Lata", barril: "Barril",
  caixa: "Caixa", fardo: "Fardo", tetra_pak: "Tetra Pak", other: "Outro",
};

const CATEGORY_LABEL: Record<string, string> = {
  beer: "Cervejas", whisky: "Whiskies", vodka: "Vodkas", gin: "Gins",
  rum: "Runs", cachaca: "Cachaças", wine: "Vinhos", sparkling: "Espumantes",
  energy: "Energéticos", soft_drink: "Refrigerantes", water: "Águas",
  juice: "Sucos", other: "Outros",
};

function itemToModalData(item: WishlistItem): ProductModalData {
  const parts = item.product_key.split("|");
  const packaging_type     = parts[3] ?? item.packaging_type;
  const packaging_volume_ml = Number(parts[4]) || item.packaging_volume_ml;
  return {
    name:                    item.product_name,
    brand:                   item.brand,
    category:                item.category,
    packaging_type,
    packaging_volume_ml,
    image_url:               item.image_url,
    cheapest_product_id:     "",
    cheapest_distributor_id: "",
    promotion:               null,
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-4 rounded-2xl border border-[#DBEAFE] bg-white p-4">
      <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/4 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
        <div className="h-3 w-1/3 rounded bg-slate-200" />
      </div>
      <div className="h-8 w-24 rounded-lg bg-slate-200" />
    </div>
  );
}

// ─── Componente de item ───────────────────────────────────────────────────────

function WishlistRow({
  item, onRemove, onCotarClick,
}: {
  item: WishlistItem;
  onRemove: () => void;
  onCotarClick: () => void;
}) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-[#DBEAFE] bg-white px-4 py-3 shadow-sm transition-all hover:border-[#2563EB]/40 hover:shadow-md">
      {/* Imagem (comentada para teste sem fotos)
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F5F7FB]">
        {item.image_url
          ? <img src={item.image_url} alt={item.product_name} className="h-12 w-12 object-contain" loading="lazy" />
          : <ShoppingCart size={20} className="text-slate-300" />}
      </div>
      */}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{item.brand}</p>
        <p className="truncate text-sm font-semibold text-[#0F172A]">{item.product_name}</p>
        <p className="text-[11px] text-slate-400">
          {CATEGORY_LABEL[item.category] ?? item.category}
          {" · "}{PACKAGING_LABEL[item.packaging_type] ?? item.packaging_type}
          {" · "}{item.packaging_volume_ml}ml
        </p>
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onCotarClick}
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-95"
        >
          <ShoppingCart size={12} />Cotar
        </button>
        <button
          onClick={onRemove}
          className="rounded-full p-1.5 text-slate-300 transition hover:text-red-500"
          title="Remover da lista"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ListaDesejosPage() {
  const { data: session } = useSession();
  const token = useApiToken();

  const [items, setItems]           = useState<WishlistItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [modalData, setModalData]   = useState<ProductModalData | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/wishlist", { method: "GET", token });
      if (res.ok) {
        const data = await res.json() as { items: WishlistItem[] };
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = useCallback(async (item: WishlistItem) => {
    if (!token) return;
    setRemovingKey(item.product_key);
    try {
      const encoded = encodeURIComponent(item.product_key);
      await apiFetch(`/api/wishlist/${encoded}`, { method: "DELETE", token });
      setItems((prev) => prev.filter((i) => i.product_key !== item.product_key));
    } finally {
      setRemovingKey(null);
    }
  }, [token]);

  const filtered = search.trim()
    ? items.filter((i) =>
        i.product_name.toLowerCase().includes(search.toLowerCase()) ||
        i.brand.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100">
            <Heart size={20} className="fill-current text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0F172A]">Lista de Desejos</h1>
            <p className="text-sm text-slate-500">
              {items.length === 0 ? "Nenhum produto salvo" : `${items.length} produto${items.length !== 1 ? "s" : ""} salvo${items.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Busca (só mostra quando há itens) */}
        {items.length > 0 && (
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome ou marca..."
              className="w-full rounded-xl border border-[#DBEAFE] bg-white py-2.5 pl-9 pr-4 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#DBEAFE] bg-white py-16 text-center">
            <Heart size={40} className="mb-4 text-slate-200" />
            {search ? (
              <>
                <p className="font-semibold text-slate-500">Nenhum resultado para "{search}"</p>
                <button onClick={() => setSearch("")} className="mt-2 text-sm text-[#2563EB] hover:underline">
                  Limpar filtro
                </button>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-500">Sua lista de desejos está vazia</p>
                <p className="mt-1 text-sm text-slate-400">
                  Clique no ícone <Heart size={12} className="mx-1 inline" /> nos produtos do catálogo para salvá-los aqui.
                </p>
                <a
                  href="/catalogo"
                  className="mt-4 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
                >
                  Ir ao catálogo
                </a>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.product_key}
                className={`transition-opacity ${removingKey === item.product_key ? "pointer-events-none opacity-50" : ""}`}
              >
                <WishlistRow
                  item={item}
                  onRemove={() => handleRemove(item)}
                  onCotarClick={() => setModalData(itemToModalData(item))}
                />
              </div>
            ))}
          </div>
        )}

        {/* Botão limpar tudo */}
        {items.length > 1 && !loading && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={async () => {
                if (!token) return;
                await Promise.all(items.map((i) => {
                  const encoded = encodeURIComponent(i.product_key);
                  return apiFetch(`/api/wishlist/${encoded}`, { method: "DELETE", token });
                }));
                setItems([]);
              }}
              className="text-sm text-slate-400 transition hover:text-red-500"
            >
              Limpar lista
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalhe do produto */}
      {modalData && (
        <ProductDetailModal
          product={modalData}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
