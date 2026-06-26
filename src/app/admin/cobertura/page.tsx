"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type CoverageCity = {
  id: string;
  city: string;
  state: string;
  active: boolean;
  waitlist_count: number;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CoberturaPage() {
  const token = useApiToken();
  const [cities, setCities] = useState<CoverageCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("SP");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/cobertura", { method: "GET", token })
      .then(async (r) => { if (r.ok) setCities(await r.json()); })
      .finally(() => setLoading(false));
  }, [token]);

  async function toggle(city: CoverageCity) {
    if (!token) return;
    setToggling(city.id);
    const res = await apiFetch(`/api/admin/cobertura/${city.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ active: !city.active }),
    });
    if (res.ok) {
      const updated = await res.json() as CoverageCity;
      setCities((prev) => prev.map((c) => c.id === city.id ? { ...c, active: updated.active } : c));
    }
    setToggling(null);
  }

  async function remove(id: string) {
    if (!token || !confirm("Remover esta cidade da cobertura?")) return;
    setToggling(id);
    const res = await apiFetch(`/api/admin/cobertura/${id}`, { method: "DELETE", token });
    if (res.ok) setCities((prev) => prev.filter((c) => c.id !== id));
    setToggling(null);
  }

  async function addCity() {
    if (!token || !newCity.trim()) return;
    setAdding(true);
    const res = await apiFetch("/api/admin/cobertura", {
      method: "POST",
      token,
      body: JSON.stringify({ city: newCity.trim(), state: newState.toUpperCase(), active: true }),
    });
    if (res.ok) {
      const created = await res.json() as CoverageCity;
      setCities((prev) => [...prev, { ...created, waitlist_count: 0 }]);
      setNewCity("");
    }
    setAdding(false);
  }

  const active = cities.filter((c) => c.active);
  const inactive = cities.filter((c) => !c.active);
  const totalWaiting = cities.reduce((s, c) => s + c.waitlist_count, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#0F172A]">Cobertura Geográfica</h1>
      <p className="mb-6 text-sm font-medium text-slate-500">
        {active.length} cidade(s) ativa(s) · {totalWaiting} comprador(es) aguardando em cidades inativas
      </p>

      {/* Adicionar cidade */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#0F172A]">Adicionar cidade à cobertura</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="Nome da cidade"
            className="flex-1 min-w-40 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-[#0F172A] outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
          />
          <input
            value={newState}
            onChange={(e) => setNewState(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="UF"
            className="w-20 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-[#0F172A] outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
          />
          <button
            disabled={!newCity.trim() || adding}
            onClick={addCity}
            className="rounded-xl bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#16A34A] disabled:opacity-50"
          >
            {adding ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : (
        <>
          {/* Ativas */}
          {active.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Ativas ({active.length})</h2>
              <div className="space-y-2">
                {active.map((city) => (
                  <CityRow key={city.id} city={city} toggling={toggling === city.id} onToggle={toggle} onRemove={remove} />
                ))}
              </div>
            </div>
          )}

          {/* Inativas */}
          {inactive.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Inativas / Aguardando ({inactive.length})</h2>
              <div className="space-y-2">
                {inactive.map((city) => (
                  <CityRow key={city.id} city={city} toggling={toggling === city.id} onToggle={toggle} onRemove={remove} />
                ))}
              </div>
            </div>
          )}

          {cities.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
              <p className="text-sm text-slate-500">Nenhuma cidade configurada. Use o formulário acima para adicionar.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function CityRow({ city, toggling, onToggle, onRemove }: {
  city: CoverageCity;
  toggling: boolean;
  onToggle: (c: CoverageCity) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[#0F172A]">{city.city} — {city.state}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${city.active ? "bg-[#22C55E]/15 text-[#16A34A]" : "bg-slate-100 text-slate-500"}`}>
            {city.active ? "Ativa" : "Inativa"}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {city.waitlist_count > 0
            ? `${city.waitlist_count} comprador(es) aguardando`
            : "Nenhum na lista de espera"} · Desde {new Date(city.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Toggle switch */}
        <button
          disabled={toggling}
          onClick={() => onToggle(city)}
          className={[
            "relative h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-50",
            city.active ? "bg-[#22C55E]" : "bg-slate-200",
          ].join(" ")}
          title={city.active ? "Desativar" : "Ativar"}
        >
          <span className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            city.active ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")} />
        </button>
        <button
          disabled={toggling}
          onClick={() => onRemove(city.id)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          title="Remover"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
