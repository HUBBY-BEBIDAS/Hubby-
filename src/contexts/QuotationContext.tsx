"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type QuotationItem = {
  id:           string;
  product_name: string;
  brand:        string;
  category:     string;
  packaging:    string;
  quantity:     number;
};

export type OpenQuotation = {
  id:     string;
  items:  QuotationItem[];
  status: string;
  orders?: any[];
};

export type AddItemParams = {
  product_name: string;
  brand:        string;
  category:     string;
  packaging:    string;
  quantity:     number;
};

export type QuotationToast = {
  message:      string;
  quotation_id: string;
};

interface QuotationContextValue {
  quotation:    OpenQuotation | null;
  itemCount:    number;
  loading:      boolean;
  toast:        QuotationToast | null;
  dismissToast: () => void;
  addItem:      (params: AddItemParams) => Promise<void>;
  refetch:      () => Promise<void>;
}

const QuotationContext = createContext<QuotationContextValue | null>(null);

export function useQuotation(): QuotationContextValue {
  const ctx = useContext(QuotationContext);
  if (!ctx) throw new Error("useQuotation must be used inside QuotationProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function QuotationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const token = useApiToken();
  const role  = (session?.user as { role?: string })?.role ?? "";
  const isClient = role === "client";

  const [quotation, setQuotation] = useState<OpenQuotation | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [toast,     setToast]     = useState<QuotationToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOpenQuotation = useCallback(async () => {
    if (!token || !isClient) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/quotations?status=open", { method: "GET", token });
      if (!res.ok) return;
      const data = await res.json() as { quotations: OpenQuotation[] };
      // Pega a cotação aberta mais recente (que não tenha pedidos enviados)
      const open = data.quotations.find((q) => q.status === "open" && (!q.orders || q.orders.length === 0)) ?? null;
      setQuotation(open);
    } catch {
      // silencia erro de rede
    } finally {
      setLoading(false);
    }
  }, [token, isClient]);

  useEffect(() => {
    fetchOpenQuotation();
  }, [fetchOpenQuotation]);

  function showToast(message: string, quotation_id: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, quotation_id });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  async function addItem(params: AddItemParams) {
    if (!token) return;

    try {
      let targetId = quotation?.id;

      if (!targetId) {
        // Cria nova cotação
        const res = await apiFetch("/api/quotations", {
          method: "POST",
          token,
          body: JSON.stringify({
            items: [{
              product_name: params.product_name,
              brand:        params.brand,
              category:     params.category,
              packaging:    params.packaging,
              quantity:     params.quantity,
            }],
          }),
        });
        if (!res.ok) throw new Error("Erro ao criar cotação");
        const data = await res.json() as { quotation: OpenQuotation };
        setQuotation(data.quotation);
        targetId = data.quotation.id;
      } else {
        // Adiciona à cotação existente
        const res = await apiFetch(`/api/quotations/${targetId}/items`, {
          method: "POST",
          token,
          body: JSON.stringify(params),
        });
        if (!res.ok) throw new Error("Erro ao adicionar item");
        const data = await res.json() as { quotation: OpenQuotation };
        setQuotation(data.quotation);
      }

      showToast(
        `${params.product_name} adicionado à cotação`,
        targetId!
      );
    } catch (err) {
      console.error("[QuotationContext] addItem error:", err);
    }
  }

  const itemCount = quotation?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <QuotationContext.Provider
      value={{
        quotation,
        itemCount,
        loading,
        toast,
        dismissToast: () => setToast(null),
        addItem,
        refetch: fetchOpenQuotation,
      }}
    >
      {children}
    </QuotationContext.Provider>
  );
}
