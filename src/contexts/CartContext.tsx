"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CartProduct = {
  name:               string;
  brand:              string;
  category:           string;
  packaging_type:     string;
  packaging_volume_ml: number;
  price_cents:        number;
  image_url:          string | null;
};

export type CartDistributor = {
  company_name: string;
  logo_key:     string | null;
};

export type CartItem = {
  id:                  string;
  product_id:          string;
  distributor_id:      string;
  quantity:            number;
  added_at:            string;
  product:             CartProduct;
  distributor:         CartDistributor;
  minimum_order_cents: number;
};

export type CartDistributorGroup = {
  distributor_id:      string;
  distributor:         CartDistributor;
  items:               CartItem[];
  subtotalCents:       number;
  minimum_order_cents: number;
};

interface CartContextValue {
  items:          CartItem[];
  groups:         CartDistributorGroup[];
  itemCount:      number;
  totalCents:     number;
  drawerOpen:     boolean;
  loading:        boolean;
  openDrawer:     () => void;
  closeDrawer:    () => void;
  addItem:        (productId: string, distributorId: string, qty?: number) => Promise<void>;
  removeItem:     (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, qty: number) => Promise<void>;
  clearCart:      () => Promise<void>;
  checkout:       () => Promise<string>;
  isInCart:       (productId: string, distributorId: string) => boolean;
  getQuantity:    (productId: string, distributorId: string) => number;
  getItemId:      (productId: string, distributorId: string) => string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const token = useApiToken();
  const role = (session?.user as { role?: string })?.role ?? "";
  const isClient = role === "client";

  const [items, setItems]       = useState<CartItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Evita fetch duplo
  const fetchedRef = useRef(false);

  const fetchCart = useCallback(async () => {
    if (!token || !isClient) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/cart", { method: "GET", token });
      if (res.ok) {
        const data = await res.json() as { items: CartItem[] };
        setItems(data.items);
      }
    } catch {
      // silencia erros de rede
    } finally {
      setLoading(false);
    }
  }, [token, isClient]);

  useEffect(() => {
    if (!token || !isClient) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchCart();
  }, [fetchCart, token, isClient]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const itemCount  = items.reduce((s, i) => s + i.quantity, 0);
  const totalCents = items.reduce((s, i) => s + i.product.price_cents * i.quantity, 0);

  const groups: CartDistributorGroup[] = (() => {
    const map = new Map<string, CartDistributorGroup>();
    for (const item of items) {
      if (!map.has(item.distributor_id)) {
        map.set(item.distributor_id, {
          distributor_id:      item.distributor_id,
          distributor:         item.distributor,
          items:               [],
          subtotalCents:       0,
          minimum_order_cents: item.minimum_order_cents,
        });
      }
      const g = map.get(item.distributor_id)!;
      g.items.push(item);
      g.subtotalCents += item.product.price_cents * item.quantity;
    }
    return [...map.values()];
  })();

  // ── Helpers de lookup ──────────────────────────────────────────────────────

  function isInCart(productId: string, distributorId: string): boolean {
    return items.some((i) => i.product_id === productId && i.distributor_id === distributorId);
  }
  function getQuantity(productId: string, distributorId: string): number {
    return items.find((i) => i.product_id === productId && i.distributor_id === distributorId)?.quantity ?? 0;
  }
  function getItemId(productId: string, distributorId: string): string | null {
    return items.find((i) => i.product_id === productId && i.distributor_id === distributorId)?.id ?? null;
  }

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function addItem(productId: string, distributorId: string, qty = 1) {
    if (!token) return;

    // Optimistic update: se já existe, incrementa; senão cria placeholder
    const existing = items.find((i) => i.product_id === productId && i.distributor_id === distributorId);
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === existing.id ? { ...i, quantity: i.quantity + qty } : i
        )
      );
    }

    try {
      const res = await apiFetch("/api/cart", {
        method: "POST",
        token,
        body: JSON.stringify({ product_id: productId, distributor_id: distributorId, quantity: qty }),
      });
      if (res.ok) {
        // Re-fetch para garantir dados completos (product, distributor, minimum)
        await fetchCart();
      } else {
        // Reverte optimistic
        if (existing) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === existing.id ? { ...i, quantity: i.quantity - qty } : i
            )
          );
        }
      }
    } catch {
      if (existing) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity - qty } : i
          )
        );
      }
    }
  }

  async function removeItem(itemId: string) {
    if (!token) return;
    // Optimistic
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await apiFetch(`/api/cart/${itemId}`, { method: "DELETE", token });
    } catch {
      await fetchCart(); // reverte
    }
  }

  async function updateQuantity(itemId: string, qty: number) {
    if (!token) return;
    if (qty < 1) { await removeItem(itemId); return; }
    // Optimistic
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i)));
    try {
      await apiFetch(`/api/cart/${itemId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ quantity: qty }),
      });
    } catch {
      await fetchCart();
    }
  }

  async function clearCart() {
    if (!token) return;
    setItems([]);
    try {
      await apiFetch("/api/cart", { method: "DELETE", token });
    } catch {
      await fetchCart();
    }
  }

  async function checkout(): Promise<string> {
    if (!token) throw new Error("Não autenticado");
    const res = await apiFetch("/api/cart/checkout", { method: "POST", token });
    const data = await res.json() as { quotation_id?: string; error?: string };
    if (!res.ok || !data.quotation_id) throw new Error(data.error ?? "Erro ao criar cotação");
    setItems([]); // limpa localmente
    return data.quotation_id;
  }

  return (
    <CartContext.Provider
      value={{
        items,
        groups,
        itemCount,
        totalCents,
        drawerOpen,
        loading,
        openDrawer:  () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        checkout,
        isInCart,
        getQuantity,
        getItemId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
