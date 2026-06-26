"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type SurveyData = {
  total: number;
  answered: number;
  skipped: number;
  response_rate: number;
  breakdown: {
    orders_per_month:    Record<string, number>;
    monthly_spend_range: Record<string, number>;
    distributors_count:  Record<string, number>;
    referral_source:     Record<string, number>;
    main_pain:           Record<string, number>;
    beverage_types:      Record<string, number>;
  };
};

const QUESTION_LABELS: Record<string, string> = {
  orders_per_month:    "Pedidos por mês",
  monthly_spend_range: "Gasto mensal em bebidas",
  distributors_count:  "Distribuidoras usadas hoje",
  referral_source:     "Como ficou sabendo da Hubby",
  main_pain:           "Maior dificuldade ao comprar",
  beverage_types:      "Tipos de bebida mais comprados",
};

const BAR_COLOR = "#22C55E";

function BreakdownChart({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const max = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 1;

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-[#0F172A]">{label}</h3>
        <p className="text-xs text-slate-400">Sem respostas ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-[#0F172A]">{label}</h3>
      <div className="space-y-2.5">
        {entries.map(([key, val]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 truncate max-w-[75%]">{key}</span>
              <span className="text-xs font-bold text-[#0F172A]">{val}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${(val / max) * 100}%`, background: BAR_COLOR }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadCSV(data: SurveyData) {
  const rows: string[] = ["Pergunta,Resposta,Respostas"];
  for (const [questionKey, breakdown] of Object.entries(data.breakdown)) {
    const label = QUESTION_LABELS[questionKey] ?? questionKey;
    for (const [answer, count] of Object.entries(breakdown)) {
      rows.push(`"${label}","${answer}",${count}`);
    }
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pesquisa-onboarding.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function PesquisaPage() {
  const token = useApiToken();
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/admin/pesquisa", { method: "GET", token })
      .then(async (r) => { if (r.ok) setData(await r.json()); })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      </main>
    );
  }

  if (!data) {
    return <main className="mx-auto max-w-5xl px-4 py-8"><p className="text-sm text-slate-500">Erro ao carregar dados.</p></main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Pesquisa de Onboarding</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Respostas coletadas no cadastro dos compradores</p>
        </div>
        <button
          onClick={() => downloadCSV(data)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F172A] shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total de cadastros", value: String(data.total) },
          { label: "Responderam", value: String(data.answered), color: "text-[#22C55E]" },
          { label: "Pularam", value: String(data.skipped), color: "text-amber-600" },
          { label: "Taxa de resposta", value: `${data.response_rate}%`, color: data.response_rate >= 50 ? "text-[#22C55E]" : "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
            <p className={`mt-1 text-3xl font-extrabold tracking-tight ${k.color ?? "text-[#0F172A]"}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Object.entries(data.breakdown).map(([key, breakdown]) => (
          <BreakdownChart
            key={key}
            label={QUESTION_LABELS[key] ?? key}
            data={breakdown}
          />
        ))}
      </div>
    </main>
  );
}
