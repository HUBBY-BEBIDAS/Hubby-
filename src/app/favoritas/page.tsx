"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Heart, Star } from "lucide-react";

type FavoriteEntry = {
  id: string;
  distributor_id: string;
  created_at: string;
  distributor: {
    id: string;
    company_name: string;
    average_rating: number | null;
    review_count: number;
    whatsapp_commercial: string;
    email_commercial: string;
  };
  last_order: { sent_at: string; total_cents: number } | null;
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function FavoritasPage() {
  const { data: session, status } = useSession({ required: true });
  const router  = useRouter();
  const token   = useApiToken();
  const role    = (session?.user as { role?: string })?.role ?? "";

  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && role && role !== "client") router.replace("/");
  }, [status, role, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/favorites", { method: "GET", token })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json() as { favorites: FavoriteEntry[] };
          setFavorites(d.favorites ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function removeFavorite(distributorId: string) {
    if (!token) return;
    setRemovingId(distributorId);
    await apiFetch(`/api/favorites/${distributorId}`, { method: "DELETE", token });
    setFavorites((prev) => prev.filter((f) => f.distributor_id !== distributorId));
    setRemovingId(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB]">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-[#0F172A]">Distribuidoras favoritas</h1>
            <p className="mt-1 text-sm text-slate-500">
              {favorites.length > 0
                ? `${favorites.length} distribuidora${favorites.length !== 1 ? "s" : ""} salva${favorites.length !== 1 ? "s" : ""}`
                : "Suas distribuidoras de confiança ficam aqui"}
            </p>
          </div>
          <button
            onClick={() => router.push("/cotacao")}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
          >
            Nova cotação
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-2xl bg-[#DBEAFE]/40" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="rounded-2xl border border-[#DBEAFE] bg-white px-6 py-16 text-center">
            <Heart size={36} className="text-slate-200 mx-auto" />
            <p className="mt-4 text-lg font-bold text-slate-700">Nenhuma distribuidora favorita</p>
            <p className="mt-2 text-sm text-slate-400">
              No ranking de cotações, clique no coração ao lado de uma distribuidora para salvá-la aqui.
            </p>
            <button
              onClick={() => router.push("/cotacao")}
              className="mt-5 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1D4ED8]"
            >
              Fazer uma cotação
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 rounded-2xl border border-[#DBEAFE] bg-white p-5 shadow-sm"
              >
                {/* Avatar */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-lg font-black text-[#2563EB]">
                  {f.distributor.company_name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0F172A] truncate">{f.distributor.company_name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {f.distributor.average_rating != null && f.distributor.review_count > 0 && (
                      <span className="inline-flex items-center gap-0.5"><Star size={11} className="fill-amber-400 text-amber-400" />{f.distributor.average_rating.toFixed(1)} ({f.distributor.review_count})</span>
                    )}
                    {f.last_order && (
                      <span>
                        Última compra: {formatBRL(f.last_order.total_cents)} em {formatDate(f.last_order.sent_at)}
                      </span>
                    )}
                    <span>Favorita desde {formatDate(f.created_at)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`https://wa.me/${f.distributor.whatsapp_commercial.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-[#DBEAFE] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-[#F5F7FB]"
                  >
                    <svg className="h-3.5 w-3.5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <button
                    onClick={() => removeFavorite(f.distributor_id)}
                    disabled={removingId === f.distributor_id}
                    className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40"
                  >
                    {removingId === f.distributor_id ? "…" : "Remover"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer do sistema */}
      <div className="border-t border-[#DBEAFE] py-4 text-center text-xs text-slate-400">
        <a href="/termos" className="hover:text-slate-600">Termos de Uso</a>
        {" · "}
        <a href="/privacidade" className="hover:text-slate-600">Privacidade</a>
        {" · "}
        <a href="/suporte" className="hover:text-slate-600">Suporte</a>
      </div>
    </div>
  );
}
