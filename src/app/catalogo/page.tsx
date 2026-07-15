"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ProductDetailModal, type ProductModalData } from "@/components/ProductDetailModal";
import {
  Tag, Search, ShoppingCart, Flame, Heart, LayoutGrid, List,
  TrendingUp, TrendingDown, SlidersHorizontal, X, ChevronDown,
  GitCompare, Sparkles, Clock, Check,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Promotion = {
  type: "percentage" | "fixed_price";
  discount_percentage: number | null;
  promotional_price_cents: number | null;
  description: string | null;
};

type CatalogProduct = {
  key: string;
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  min_price_cents: number;
  effective_price_cents: number;
  image_url: string | null;
  distributor_count: number;
  cheapest_product_id: string;
  cheapest_distributor_id: string;
  is_sponsored?: boolean;
  price_trend: "up" | "down" | "stable" | null;
  price_change_pct: number | null;
  price_updated_at: string | null;
  promotion: Promotion | null;
};

type NearExpiryOffer = {
  id: string; discount_pct: number; stock: number; expires_at: string;
  product: { id: string; name: string; brand: string; category: string; packaging_type: string; packaging_volume_ml: number; price_cents: number; image_url: string | null };
  distributor: { id: string; company_name: string };
};

type AutocompleteItem = { id: string; name: string; brand: string; packaging_type: string; packaging_volume_ml: number };

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "", label: "Todos" },
  { value: "beer", label: "Cervejas" },
  { value: "whisky", label: "Whiskies" },
  { value: "vodka", label: "Vodkas" },
  { value: "gin", label: "Gins" },
  { value: "rum", label: "Runs" },
  { value: "cachaca", label: "Cachaças" },
  { value: "wine", label: "Vinhos" },
  { value: "sparkling", label: "Espumantes" },
  { value: "energy", label: "Energéticos" },
  { value: "soft_drink", label: "Refrigerantes" },
  { value: "water", label: "Águas" },
  { value: "juice", label: "Sucos" },
  { value: "other", label: "Outros" },
];

const PACKAGING_LABEL: Record<string, string> = {
  garrafa: "Garrafa", lata: "Lata", barril: "Barril",
  caixa: "Caixa", fardo: "Fardo", tetra_pak: "Tetra Pak", other: "Outro",
};

const SORT_OPTIONS = [
  { value: "cheapest", label: "Mais barato" },
  { value: "popular", label: "Mais popular" },
  { value: "newest", label: "Lançamentos" },
  { value: "promo_first", label: "Promoções primeiro" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function promoLabel(p: Promotion) {
  if (p.type === "percentage" && p.discount_percentage != null)
    return `-${p.discount_percentage.toFixed(0)}%`;
  return "PROMO";
}

function productToModalData(p: CatalogProduct): ProductModalData {
  return {
    name: p.name, brand: p.brand, category: p.category,
    packaging_type: p.packaging_type, packaging_volume_ml: p.packaging_volume_ml,
    image_url: p.image_url, cheapest_product_id: p.cheapest_product_id,
    cheapest_distributor_id: p.cheapest_distributor_id, promotion: p.promotion,
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard({ list }: { list?: boolean }) {
  if (list) return (
    <div className="flex animate-pulse items-center gap-4 rounded-2xl border border-[#DBEAFE] bg-white p-4">
      <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/4 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
      </div>
      <div className="h-6 w-20 rounded-lg bg-slate-200" />
    </div>
  );
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white">
      <div className="h-36 bg-slate-200" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-5 w-1/2 rounded bg-slate-200" />
      </div>
    </div>
  );
}

// ─── Card de produto ──────────────────────────────────────────────────────────

function ProductCard({
  product, onClick, wishlisted, onToggleWishlist,
  compareChecked, onToggleCompare, listView,
}: {
  product: CatalogProduct;
  onClick: () => void;
  wishlisted: boolean;
  onToggleWishlist: (e: React.MouseEvent) => void;
  compareChecked: boolean;
  onToggleCompare: (e: React.MouseEvent) => void;
  listView: boolean;
}) {
  const hasPromo = product.promotion !== null;
  const hasDiscount = hasPromo && product.effective_price_cents < product.min_price_cents;

  if (listView) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="group flex w-full items-center gap-4 rounded-2xl border border-[#DBEAFE] bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-[#2563EB]/40 hover:shadow-md active:scale-[0.99] cursor-pointer"
      >
        {/* Checkbox comparar */}
        <div
          onClick={onToggleCompare}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${compareChecked ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300 group-hover:border-slate-400"}`}
        >
          {compareChecked && <Check size={11} className="text-white" />}
        </div>

        {/* Imagem */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F5F7FB]">
          {product.image_url
            ? <img src={product.image_url} alt={product.name} className="h-12 w-12 object-contain" />
            : <ShoppingCart size={20} className="text-slate-300" />}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{product.brand}</p>
          <p className="truncate text-sm font-semibold text-[#0F172A]">{product.name}</p>
          <p className="text-[11px] text-slate-400">
            {PACKAGING_LABEL[product.packaging_type] ?? product.packaging_type} · {product.packaging_volume_ml}ml
            {" · "}{product.distributor_count} distribuidora{product.distributor_count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Preço + tendência */}
        <div className="shrink-0 text-right">
          {hasDiscount && <p className="text-[11px] text-slate-400 line-through">{formatBRL(product.min_price_cents)}</p>}
          <p className={`text-base font-black ${hasDiscount ? "text-red-600" : "text-[#2563EB]"}`}>
            {formatBRL(product.effective_price_cents)}
          </p>
          {product.price_trend && product.price_change_pct && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${product.price_trend === "down" ? "text-green-600" : "text-red-500"}`}>
              {product.price_trend === "down" ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
              {product.price_change_pct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          {hasPromo && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
              {promoLabel(product.promotion!)}
            </span>
          )}
          {product.is_sponsored && !hasPromo && (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-400">Em destaque</span>
          )}
        </div>

        {/* Heart */}
        <button
          onClick={onToggleWishlist}
          className="shrink-0 rounded-full p-1 text-slate-300 transition hover:text-red-400"
        >
          <Heart size={16} className={wishlisted ? "fill-current text-red-500" : ""} />
        </button>
      </div>
    );
  }

  // Grid view
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white shadow-sm transition-all hover:border-[#2563EB]/40 hover:shadow-md">
      {/* Badges absolutas */}
      {hasPromo && (
        <div className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow">
          <Tag size={10} className="mr-0.5 inline" />{promoLabel(product.promotion!)}
        </div>
      )}
      {product.is_sponsored && !hasPromo && (
        <div className="absolute left-2 top-2 z-10 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-400">
          Em destaque
        </div>
      )}

      {/* Checkbox comparar (top-right) */}
      <div
        onClick={onToggleCompare}
        className={`absolute right-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border-2 bg-white transition ${compareChecked ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300 opacity-0 group-hover:opacity-100"}`}
      >
        {compareChecked && <Check size={11} className="text-white" />}
      </div>

      {/* Heart (wishlist) */}
      <button
        onClick={onToggleWishlist}
        className="absolute right-2 top-8 z-10 rounded-full bg-white p-1 text-slate-300 shadow-sm transition hover:text-red-400"
      >
        <Heart size={14} className={wishlisted ? "fill-current text-red-500" : ""} />
      </button>

      {/* Imagem — clicável */}
      <button onClick={onClick} className="flex h-36 items-center justify-center bg-[#F5F7FB]">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="h-32 w-32 object-contain" loading="lazy" />
          : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-200 text-slate-400"><ShoppingCart size={28} /></div>}
      </button>

      {/* Info */}
      <button onClick={onClick} className="flex flex-1 flex-col gap-1.5 p-4 text-left">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{product.brand}</p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-[#0F172A]">{product.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {PACKAGING_LABEL[product.packaging_type] ?? product.packaging_type} · {product.packaging_volume_ml}ml
          </p>
        </div>

        <div className="mt-auto pt-1">
          <p className="text-[10px] text-slate-400">A partir de</p>
          <div className="flex items-baseline gap-1">
            {hasDiscount && <span className="text-xs text-slate-400 line-through">{formatBRL(product.min_price_cents)}</span>}
            <span className={`text-base font-black ${hasDiscount ? "text-red-600" : "text-[#2563EB]"}`}>
              {formatBRL(product.effective_price_cents)}
            </span>
            {/* Tendência de preço */}
            {product.price_trend && product.price_change_pct && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold ${product.price_trend === "down" ? "text-green-600" : "text-red-500"}`}>
                {product.price_trend === "down" ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                {product.price_change_pct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            {product.distributor_count} distribuidora{product.distributor_count !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] py-1.5 text-[11px] font-semibold text-slate-400 transition-colors group-hover:border-[#2563EB]/30 group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB]">
          <ShoppingCart size={11} />Ver preços e cotar
        </div>
      </button>
    </div>
  );
}

// ─── Modal de comparação ──────────────────────────────────────────────────────

function CompareModal({ products, onClose, onOpenDetail }: {
  products: CatalogProduct[];
  onClose: () => void;
  onOpenDetail: (p: CatalogProduct) => void;
}) {
  const rows = [
    { label: "Preço a partir de", render: (p: CatalogProduct) => <span className="font-black text-[#2563EB]">{formatBRL(p.effective_price_cents)}</span> },
    { label: "Embalagem", render: (p: CatalogProduct) => `${PACKAGING_LABEL[p.packaging_type] ?? p.packaging_type} ${p.packaging_volume_ml}ml` },
    { label: "Distribuidoras", render: (p: CatalogProduct) => `${p.distributor_count} na sua região` },
    { label: "Promoção", render: (p: CatalogProduct) => p.promotion ? promoLabel(p.promotion) : "—" },
    {
      label: "Tendência de preço", render: (p: CatalogProduct) => {
        if (!p.price_trend || p.price_trend === "stable") return "Estável";
        const icon = p.price_trend === "down" ? "↓" : "↑";
        const color = p.price_trend === "down" ? "text-green-600" : "text-red-500";
        return <span className={color}>{icon} {p.price_change_pct?.toFixed(1)}%</span>;
      }
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#DBEAFE] px-5 py-4">
          <p className="font-bold text-[#0F172A]">Comparar produtos</p>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DBEAFE]">
                <th className="w-28 py-3 pl-5 text-left text-xs font-semibold text-slate-400">Atributo</th>
                {products.map((p) => (
                  <th key={p.key} className="py-3 px-3 text-center">
                    <button onClick={() => onOpenDetail(p)} className="flex flex-col items-center gap-1">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-xl object-contain bg-[#F5F7FB]" />
                        : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F7FB] text-slate-300"><ShoppingCart size={18} /></div>}
                      <span className="block max-w-[100px] truncate text-[11px] font-semibold text-[#0F172A]">{p.name}</span>
                      <span className="text-[10px] text-slate-400">{p.brand}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-[#DBEAFE]/50 last:border-0">
                  <td className="py-3 pl-5 text-[11px] font-semibold text-slate-500">{row.label}</td>
                  {products.map((p) => (
                    <td key={p.key} className="py-3 px-3 text-center text-xs text-[#0F172A]">{row.render(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#DBEAFE] px-5 py-3">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Mini-card horizontal (frequentes/novidades/similares) ────────────────────

function MiniCard({ product, onClick, wishlisted, onToggleWishlist }: {
  product: Partial<CatalogProduct> & { name: string; brand: string; image_url?: string | null; min_price_cents?: number | null };
  onClick: () => void;
  wishlisted?: boolean;
  onToggleWishlist?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="group relative flex w-36 shrink-0 cursor-pointer flex-col rounded-xl border border-[#DBEAFE] bg-white p-3 text-left shadow-sm transition hover:border-[#2563EB]/40 hover:shadow-md"
    >
      {onToggleWishlist && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(e); }}
          className="absolute right-2 top-2 text-slate-300 hover:text-red-400"
        >
          <Heart size={12} className={wishlisted ? "fill-current text-red-500" : ""} />
        </button>
      )}
      <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-[#F5F7FB]">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="h-14 w-14 object-contain" />
          : <ShoppingCart size={18} className="text-slate-300" />}
      </div>
      <p className="truncate text-[10px] font-bold uppercase text-slate-400">{product.brand}</p>
      <p className="truncate text-xs font-semibold text-[#0F172A]">{product.name}</p>
      {product.min_price_cents != null && (
        <p className="mt-1 text-xs font-black text-[#2563EB]">{formatBRL(product.min_price_cents)}</p>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CatalogoPage() {
  useSession({ required: true });
  const token = useApiToken();

  // Filtros
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("cheapest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [priceMax, setPriceMax] = useState(100000); // max descoberto no catalog
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Produtos + paginação
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<string[]>([]);

  // Localidade
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Seções especiais
  const [nearExpiry, setNearExpiry] = useState<NearExpiryOffer[]>([]);
  const [nearLoading, setNearLoading] = useState(true);
  const [frequentes, setFrequentes] = useState<CatalogProduct[]>([]);
  const [novidades, setNovidades] = useState<CatalogProduct[]>([]);

  // Wishlist
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set());

  // Comparar
  const [compareList, setCompareList] = useState<CatalogProduct[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // Modal
  const [modalProduct, setModalProduct] = useState<ProductModalData | null>(null);

  // Autocomplete
  const [autocomplete, setAutocomplete] = useState<AutocompleteItem[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Fetch do catálogo ──────────────────────────────────────────────────────

  const fetchCatalog = useCallback(async (pg: number, append = false) => {
    if (!token) return;
    if (pg === 1) setLoading(true); else setLoadingMore(true);

    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    if (brand) params.set("brand", brand);
    if (priceRange[0] > 0) params.set("min_price", String(priceRange[0]));
    if (priceRange[1] < priceMax) params.set("max_price", String(priceRange[1]));
    params.set("sort", sort);
    params.set("page", String(pg));
    params.set("limit", "24");

    try {
      const res = await apiFetch(`/api/catalog?${params}`, { method: "GET", token });
      const data = await res.json() as {
        products: CatalogProduct[]; brands: string[];
        city: string; state: string; total: number; total_pages: number;
      };

      if (append) setProducts((prev) => [...prev, ...data.products]);
      else setProducts(data.products ?? []);

      setBrands(data.brands ?? []);
      setTotalPages(data.total_pages ?? 1);
      setTotal(data.total ?? 0);
      if (data.city) setCity(data.city);
      if (data.state) setState(data.state);

      // Descobre preço máximo para o slider apenas no primeiro carregamento do catálogo
      if (pg === 1 && data.products.length > 0 && priceMax === 100000) {
        const max = Math.max(...data.products.map((p) => p.min_price_cents));
        const rounded = Math.ceil(max / 1000) * 1000;
        setPriceMax(rounded);
        setPriceRange([0, rounded]);
      }
    } catch { /* silencia */ }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, category, search, brand, priceRange, priceMax, sort]);

  useEffect(() => {
    setPage(1);
    setProducts([]);
    fetchCatalog(1, false);
  }, [fetchCatalog]);

  // ── Infinite scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && page < totalPages) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchCatalog(nextPage, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadingMore, page, totalPages, fetchCatalog]);

  // ── Seções especiais ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/near-expiry", { method: "GET", token })
      .then((r: Response) => r.json())
      .then((d: { offers: NearExpiryOffer[] }) => setNearExpiry(d.offers ?? []))
      .catch(() => { })
      .finally(() => setNearLoading(false));

    apiFetch("/api/catalog/frequentes", { method: "GET", token })
      .then((r: Response) => r.json())
      .then((d: { products: CatalogProduct[] }) => setFrequentes(d.products ?? []))
      .catch(() => { });

    apiFetch("/api/catalog/novidades", { method: "GET", token })
      .then((r: Response) => r.json())
      .then((d: { products: CatalogProduct[] }) => setNovidades(d.products ?? []))
      .catch(() => { });


    apiFetch("/api/wishlist", { method: "GET", token })
      .then((r: Response) => r.json())
      .then((d: { items: { product_key: string }[] }) => {
        setWishlisted(new Set(d.items.map((i) => i.product_key)));
      })
      .catch(() => { });
  }, [token]);

  // ── Debounce da busca ──────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Autocomplete ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || searchInput.length < 2) { setAutocomplete([]); setShowAutocomplete(false); return; }
    if (autocompleteRef.current) clearTimeout(autocompleteRef.current);
    autocompleteRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/products/search?q=${encodeURIComponent(searchInput)}`, { method: "GET", token });
        const data = await res.json() as { products?: AutocompleteItem[] };
        setAutocomplete((data.products ?? []).slice(0, 6));
        setShowAutocomplete(true);
      } catch { setShowAutocomplete(false); }
    }, 200);
    return () => { if (autocompleteRef.current) clearTimeout(autocompleteRef.current); };
  }, [searchInput, token]);

  // ── Wishlist toggle ────────────────────────────────────────────────────────

  function toggleWishlist(e: React.MouseEvent, product: CatalogProduct) {
    e.stopPropagation();
    if (!token) return;
    const key = product.key;
    const isIn = wishlisted.has(key);
    setWishlisted((prev) => {
      const next = new Set(prev);
      if (isIn) next.delete(key); else next.add(key);
      return next;
    });
    const encodedKey = encodeURIComponent(key);
    if (isIn) {
      apiFetch(`/api/wishlist/${encodedKey}`, { method: "DELETE", token }).catch(() => { });
    } else {
      apiFetch(`/api/wishlist/${encodedKey}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          product_name: product.name, brand: product.brand, category: product.category,
          packaging_type: product.packaging_type, packaging_volume_ml: product.packaging_volume_ml,
          image_url: product.image_url,
        }),
      }).catch(() => { });
    }
  }

  // ── Comparar ───────────────────────────────────────────────────────────────

  function toggleCompare(e: React.MouseEvent, product: CatalogProduct) {
    e.stopPropagation();
    setCompareList((prev) => {
      if (prev.some((p) => p.key === product.key)) return prev.filter((p) => p.key !== product.key);
      if (prev.length >= 3) return prev;
      return [...prev, product];
    });
  }

  // ── Cálculo de promoCount ──────────────────────────────────────────────────

  const promoCount = useMemo(() => products.filter((p) => p.promotion !== null).length, [products]);

  return (
    <>
      <div className="min-h-screen bg-[#F5F7FB]">
        <Navbar />

        <main className="mx-auto w-full max-w-6xl px-4 py-8">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Catálogo de produtos</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {city ? `Menores preços em ${city} / ${state}` : "Carregando sua região…"}
                {promoCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                    <Tag size={10} className="mr-0.5 inline" />{promoCount} em promoção
                  </span>
                )}
              </p>
            </div>
            {/* Toggle grid/lista */}
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#DBEAFE] bg-white p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2 transition ${viewMode === "grid" ? "bg-[#2563EB] text-white" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2 transition ${viewMode === "list" ? "bg-[#2563EB] text-white" : "text-slate-400 hover:text-slate-600"}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* ── Busca com autocomplete ───────────────────────────────────── */}
          <div className="relative mb-4">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Buscar por nome ou marca…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => autocomplete.length > 0 && setShowAutocomplete(true)}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                className="w-full max-w-sm rounded-xl border border-[#DBEAFE] bg-white py-2.5 pl-9 pr-4 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            {showAutocomplete && autocomplete.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-1 w-full max-w-sm rounded-2xl border border-[#DBEAFE] bg-white shadow-xl">
                {autocomplete.map((item) => (
                  <button
                    key={item.id}
                    onMouseDown={() => { setSearchInput(item.name); setSearch(item.name); setShowAutocomplete(false); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F7FB] first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <Search size={13} className="shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0F172A]">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.brand} · {PACKAGING_LABEL[item.packaging_type] ?? item.packaging_type} {item.packaging_volume_ml}ml</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Filtros: categorias ──────────────────────────────────────── */}
          <div className="mb-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => { setCategory(c.value); setBrand(""); }}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  category === c.value
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#EFF6FF]",
                ].join(" ")}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* ── Filtros avançados + ordenação ────────────────────────────── */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {/* Sort */}
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  sort === s.value
                    ? "bg-[#0F172A] text-white"
                    : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#F5F7FB]",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}

            {/* Filtros avançados toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                showFilters ? "bg-[#EFF6FF] text-[#2563EB]" : "border border-[#DBEAFE] bg-white text-slate-600 hover:bg-[#F5F7FB]",
              ].join(" ")}
            >
              <SlidersHorizontal size={12} />Filtros
              {(brand || priceRange[0] > 0 || priceRange[1] < priceMax) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563EB] text-[9px] text-white">!</span>
              )}
            </button>

            {/* Limpar filtros */}
            {(brand || priceRange[0] > 0 || priceRange[1] < priceMax || search) && (
              <button
                onClick={() => { setBrand(""); setPriceRange([0, priceMax]); setSearch(""); setSearchInput(""); }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#2563EB]"
              >
                <X size={11} />Limpar
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mb-6 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm">
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Marcas */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600">Marca</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    <button
                      onClick={() => setBrand("")}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${!brand ? "bg-[#2563EB] text-white" : "border border-[#DBEAFE] text-slate-600 hover:bg-[#EFF6FF]"}`}
                    >
                      Todas
                    </button>
                    {brands.map((b) => (
                      <button
                        key={b}
                        onClick={() => setBrand(brand === b ? "" : b)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${brand === b ? "bg-[#2563EB] text-white" : "border border-[#DBEAFE] text-slate-600 hover:bg-[#EFF6FF]"}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Faixa de preço */}
                <div>
                  <p className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Faixa de preço</span>
                    <span className="text-[#2563EB]">{formatBRL(priceRange[0])} – {formatBRL(priceRange[1])}</span>
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="range" min={0} max={priceMax} step={100}
                      value={priceRange[0]}
                      onChange={(e) => { const v = parseInt(e.target.value); if (v <= priceRange[1]) setPriceRange([v, priceRange[1]]); }}
                      className="w-full accent-[#2563EB]"
                    />
                    <input
                      type="range" min={0} max={priceMax} step={100}
                      value={priceRange[1]}
                      onChange={(e) => { const v = parseInt(e.target.value); if (v >= priceRange[0]) setPriceRange([priceRange[0], v]); }}
                      className="w-full accent-[#2563EB]"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>R$0</span><span>{formatBRL(priceMax)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Meus produtos frequentes ──────────────────────────────────── */}
          {frequentes.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Clock size={15} className="text-[#2563EB]" />
                <p className="text-sm font-bold text-[#0F172A]">Meus produtos frequentes</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {frequentes.map((p) => (
                  <MiniCard
                    key={p.key}
                    product={p}
                    onClick={() => setModalProduct(productToModalData(p))}
                    wishlisted={wishlisted.has(p.key)}
                    onToggleWishlist={(e) => toggleWishlist(e, p)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Novidades na sua região ───────────────────────────────────── */}
          {novidades.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500" />
                <p className="text-sm font-bold text-[#0F172A]">Novidades na sua região</p>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Últimos 7 dias</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {novidades.map((p) => (
                  <MiniCard
                    key={p.key}
                    product={p}
                    onClick={() => setModalProduct(productToModalData(p))}
                    wishlisted={wishlisted.has(p.key)}
                    onToggleWishlist={(e) => toggleWishlist(e, p)}
                  />
                ))}
              </div>
            </div>
          )}


          {/* ── Ofertas com prazo ─────────────────────────────────────────── */}
          {!nearLoading && nearExpiry.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Flame size={16} className="text-red-500" />
                <p className="text-base font-bold text-[#0F172A]">Ofertas com prazo — aproveite antes que acabe</p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {nearExpiry.length} oferta{nearExpiry.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...nearExpiry].sort((a, b) => b.discount_pct - a.discount_pct).map((offer) => {
                  const daysLeft = Math.max(0, Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  const isUrgent = daysLeft <= 7;
                  const discountedCents = Math.round(offer.product.price_cents * (1 - offer.discount_pct / 100));
                  return (
                    <div key={offer.id} className={`flex items-start gap-3 rounded-2xl border p-4 ${isUrgent ? "border-red-300 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
                      {offer.product.image_url
                        ? <img src={offer.product.image_url} alt={offer.product.name} className="h-14 w-14 shrink-0 rounded-xl object-contain bg-white" loading="lazy" />
                        : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-slate-300"><ShoppingCart size={18} /></div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#0F172A]">{offer.product.name}</p>
                            <p className="text-[11px] text-slate-500">{offer.distributor.company_name}</p>
                          </div>
                          <span className={`shrink-0 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${isUrgent ? "bg-red-600 text-white" : "bg-orange-100 text-orange-700"}`}>
                            <Clock size={9} />{daysLeft}d{isUrgent ? "!" : ""}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-slate-400 line-through">{formatBRL(offer.product.price_cents)}</span>
                          <span className="text-base font-black text-green-600">{formatBRL(discountedCents)}</span>
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-black text-green-700">-{offer.discount_pct}%</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{offer.stock} un disponíveis</p>
                        <button
                          onClick={() => setModalProduct({
                            name: offer.product.name, brand: offer.product.brand, category: offer.product.category,
                            packaging_type: offer.product.packaging_type, packaging_volume_ml: offer.product.packaging_volume_ml,
                            image_url: offer.product.image_url, cheapest_product_id: offer.product.id,
                            cheapest_distributor_id: offer.distributor.id, promotion: null,
                          })}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 py-1.5 text-xs font-bold text-white transition hover:bg-green-700 active:scale-95"
                        >
                          <ShoppingCart size={12} />Ver preços e cotar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Grid de produtos + infinite scroll ───────────────────────── */}
          <div className="mb-2 flex items-center justify-between">
            {!loading && total > 0 && (
              <p className="text-xs text-slate-400">
                {total} produto{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              </p>
            )}
            {compareList.length > 0 && (
              <p className="text-xs text-slate-400">{compareList.length} selecionado{compareList.length !== 1 ? "s" : ""} para comparar</p>
            )}
          </div>

          {loading ? (
            <div className={viewMode === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "space-y-3"}>
              {[...Array(12)].map((_, i) => <SkeletonCard key={i} list={viewMode === "list"} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-16 text-center">
              <Search size={32} className="mx-auto text-slate-200" />
              <p className="mt-3 font-semibold text-slate-700">Nenhum produto encontrado</p>
              <p className="mt-1 text-sm text-slate-400">Tente ajustar os filtros ou a busca.</p>
            </div>
          ) : (
            <>
              <div className={viewMode === "grid"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "space-y-3"}>
                {products.map((p) => (
                  <ProductCard
                    key={p.key}
                    product={p}
                    onClick={() => setModalProduct(productToModalData(p))}
                    wishlisted={wishlisted.has(p.key)}
                    onToggleWishlist={(e) => toggleWishlist(e, p)}
                    compareChecked={compareList.some((c) => c.key === p.key)}
                    onToggleCompare={(e) => toggleCompare(e, p)}
                    listView={viewMode === "list"}
                  />
                ))}
              </div>

              {/* Skeleton loading do infinite scroll */}
              {loadingMore && (
                <div className={`mt-4 ${viewMode === "grid" ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "space-y-3"}`}>
                  {[...Array(4)].map((_, i) => <SkeletonCard key={i} list={viewMode === "list"} />)}
                </div>
              )}

              {/* Sentinel para IntersectionObserver */}
              <div ref={sentinelRef} className="h-8" />

              {page >= totalPages && products.length > 0 && !loadingMore && (
                <p className="mt-4 text-center text-xs text-slate-400">Todos os produtos carregados</p>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modais e elementos flutuantes */}

      {/* Botão flutuante de comparação */}
      {compareList.length >= 2 && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2">
          <button
            onClick={() => setShowCompare(true)}
            className="flex items-center gap-2 rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-[#1E293B] active:scale-95"
          >
            <GitCompare size={16} />
            Comparar {compareList.length} produto{compareList.length !== 1 ? "s" : ""}
            {compareList.length < 3 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">+{3 - compareList.length} opções</span>
            )}
            <button onClick={(e) => { e.stopPropagation(); setCompareList([]); }} className="ml-1 text-white/50 hover:text-white">
              <X size={13} />
            </button>
          </button>
        </div>
      )}

      {/* Modal de comparação */}
      {showCompare && (
        <CompareModal
          products={compareList}
          onClose={() => setShowCompare(false)}
          onOpenDetail={(p) => { setShowCompare(false); setModalProduct(productToModalData(p)); }}
        />
      )}

      {/* Modal de detalhe do produto */}
      {modalProduct && (
        <ProductDetailModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
        />
      )}
    </>
  );
}
