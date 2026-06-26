"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type WaitlistGroup = { city: string; state: string; count: number; emails: string[] };

export default function AdminListaEsperaPage() {
  const token = useApiToken();
  const [list, setList] = useState<WaitlistGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/lista-espera", { method: "GET", token })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json() as { waitlist: WaitlistGroup[]; total: number };
          setList(d.waitlist);
          setTotal(d.total);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  function exportCSV() {
    const rows = [
      ["Cidade", "Estado", "Total", "Emails"],
      ...list.map((g) => [g.city, g.state, g.count, g.emails.join("; ")]),
    ];
    const csv  = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "lista-espera.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Lista de Espera</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{total} emails em {list.length} cidades</p>
        </div>
        <button onClick={exportCSV}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F172A] shadow-sm hover:bg-slate-50">
          Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      ) : (
        <div className="space-y-3">
          {list.map((g) => (
            <div key={`${g.city}-${g.state}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0F172A]">{g.city} — {g.state}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{g.emails.slice(0, 3).join(", ")}{g.emails.length > 3 ? ` e mais ${g.emails.length - 3}` : ""}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#22C55E]/10 text-lg font-extrabold text-[#22C55E]">
                  {g.count}
                </span>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="py-10 text-center text-sm font-medium text-slate-400">Lista de espera vazia.</p>}
        </div>
      )}
    </main>
  );
}
