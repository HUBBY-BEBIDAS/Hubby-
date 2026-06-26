"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Check } from "lucide-react";

// Recursos do plano Pro para exibir enquanto carrega / para usuários não logados
const PRO_FEATURES = [
  "Cotação em qualquer região do Brasil",
  "Até 10 usuários na mesma conta",
  "Histórico ilimitado + relatórios de economia mensal",
  "Listas salvas ilimitadas",
  "Alertas de queda de preço por produto",
  "Suporte prioritário por WhatsApp",
];

function CheckoutCompradorContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useApiToken();

  const cancelled = searchParams.get("cancelado") === "1";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redireciona para registro se não autenticado
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/register?redirect=/checkout/comprador");
    }
  }, [status, router]);

  // Usuário já tem plano pro (verifica via session customizada)
  const isPro = (session?.user as { client_plan?: string } | undefined)?.client_plan === "pro";

  async function handleCheckout() {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/api/billing/buyer/checkout", {
        method: "POST",
        token,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao iniciar checkout.");
        setLoading(false);
        return;
      }

      // Redireciona para o Stripe Checkout
      window.location.href = data.checkout_url;
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <div className="mx-auto w-full max-w-lg px-4 py-16">

        {/* Logo */}
        <div className="mb-8 text-center text-base font-black uppercase tracking-[0.22em] text-[#0F172A]">
          HUBBY
        </div>

        <div className="rounded-[2rem] border border-[#DBEAFE] bg-white p-8 shadow-xl">

          {/* Header */}
          <div className="mb-6 text-center">
            <span className="inline-flex rounded-full bg-[#22C55E]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#22C55E]">
              Plano Pro — Comprador
            </span>
            <div className="mt-3 flex items-baseline justify-center gap-1">
              <span className="text-4xl font-display font-extrabold text-[#0F172A]">R$ 99</span>
              <span className="text-slate-500">/mês</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Para redes, grupos e compradores de alto volume
            </p>
          </div>

          {/* Features */}
          <ul className="mb-8 space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]">
                  <Check size={12} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* Cancelamento anterior */}
          {cancelled && (
            <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Checkout cancelado. Sem cobrança. Você pode tentar novamente quando quiser.
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Já é Pro */}
          {isPro ? (
            <div className="rounded-2xl bg-[#22C55E]/10 px-4 py-4 text-center">
              <p className="font-bold text-[#22C55E]"><Check size={14} className="inline mr-1" />Você já tem o plano Pro ativo</p>
              <button
                onClick={() => router.push("/cotacao")}
                className="mt-3 text-sm font-medium text-slate-600 underline"
              >
                Ir para cotações
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleCheckout}
                disabled={loading || !token}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#22C55E] py-4 text-base font-bold text-white shadow-lg shadow-green-500/25 transition hover:bg-green-500 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Aguarde…
                  </>
                ) : (
                  "Assinar Pro — R$ 99/mês"
                )}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                Pagamento seguro via Stripe · Cancele quando quiser
              </p>
            </>
          )}
        </div>

        <button
          onClick={() => router.back()}
          className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-600"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}

export default function CheckoutCompradorPage() {
  return (
    <Suspense>
      <CheckoutCompradorContent />
    </Suspense>
  );
}
