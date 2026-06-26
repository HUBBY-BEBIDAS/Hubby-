"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShoppingCart, ArrowRight, X, Check } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";

export function FloatingQuotationButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const { quotation, itemCount, toast, dismissToast } = useQuotation();

  const role     = (session?.user as { role?: string })?.role ?? "";
  const isClient = role === "client";

  if (!isClient) return null;

  return (
    <>
      {/* Toast de confirmação */}
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-green-200 bg-white p-4 shadow-xl sm:bottom-20 sm:right-6">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check size={16} className="text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0F172A]">{toast.message}</p>
            <button
              onClick={() => { dismissToast(); router.push(`/cotacao/${toast.quotation_id}/ranking`); }}
              className="mt-0.5 text-xs font-bold text-[#22C55E] hover:underline"
            >
              Ver cotação →
            </button>
          </div>
          <button onClick={dismissToast} className="shrink-0 text-slate-300 hover:text-slate-500">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Botão flutuante — aparece quando há itens */}
      {itemCount > 0 && quotation && (
        <button
          onClick={() => router.push(`/cotacao/${quotation.id}/ranking`)}
          className="fixed bottom-5 right-4 z-40 flex items-center gap-2.5 rounded-2xl bg-[#22C55E] px-5 py-3.5 shadow-xl shadow-green-900/20 transition hover:bg-[#16A34A] active:scale-95 sm:right-6"
        >
          <div className="relative">
            <ShoppingCart size={20} className="text-white" />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-[#22C55E]">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          </div>
          <span className="text-sm font-extrabold text-white">Ver cotação</span>
          <ArrowRight size={16} className="text-white/80" />
        </button>
      )}
    </>
  );
}
