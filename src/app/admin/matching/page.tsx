"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type UnmatchedSuggestion = {
  id: string;
  master_product_id: string;
  confidence: number;
  rank: number;
  master_product: {
    id: string;
    name: string;
    brand: string;
    unit_volume_ml: number;
    units_per_package: number;
    package_type: string;
    images: { url: string }[];
  };
};

type UnmatchedItem = {
  id: string;
  raw_name: string;
  ean_code: string | null;
  brand_extracted: string | null;
  packaging_extracted: string | null;
  volume_extracted_ml: number | null;
  created_at: string;
  distributor: { id: string; company_name: string };
  suggestions: UnmatchedSuggestion[];
};

export default function AdminMatchingQueuePage() {
  const token = useApiToken();
  const [items, setItems] = useState<UnmatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchQueue = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/matching", { token });
      if (res.ok) {
        const data = await res.json();
        setItems(data.pending_items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [token]);

  const handleApprove = async (unmatchedItemId: string, masterProductId: string) => {
    if (!token) return;
    setApprovingId(unmatchedItemId);
    setFeedback(null);

    try {
      const res = await apiFetch("/api/admin/matching/approve", {
        method: "POST",
        token,
        body: JSON.stringify({
          unmatched_import_id: unmatchedItemId,
          master_product_id: masterProductId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback("✅ Vínculo aprovado e sinônimo gravado no banco de conhecimento!");
        // Remove item aprovado da lista da fila
        setItems((prev) => prev.filter((i) => i.id !== unmatchedItemId));
      } else {
        setFeedback(`❌ Erro: ${data.error || "Falha ao aprovar vínculo"}`);
      }
    } catch {
      setFeedback("❌ Erro de conexão com o servidor.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🧠 Fila de Curadoria de Produtos</span>
          <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
            {items.length} Pendente(s)
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Aprove a sugestão de correspondência em 1 clique. O sistema aprende o nome abreviado e associa automaticamente para todas as distribuidoras do Brasil.
        </p>
      </div>

      {feedback && (
        <div className="mb-6 p-4 rounded-lg bg-slate-800 border border-slate-700 text-sm">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Carregando fila de curadoria...</div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-lg font-bold text-white mb-1">Nenhum produto pendente!</h3>
          <p className="text-slate-400 text-sm">
            Todos os produtos importados pelas distribuidoras foram associados com sucesso ao Catálogo Oficial.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl hover:border-slate-700 transition"
            >
              {/* Informação do Produto Importado */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                <div>
                  <span className="text-xs font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Produto Importado por: <strong className="text-slate-300">{item.distributor.company_name}</strong>
                  </span>
                  <h3 className="text-xl font-bold text-amber-400 font-mono">
                    "{item.raw_name}"
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span>EAN: {item.ean_code || "—"}</span>
                  <span>|</span>
                  <span>Extraído: {item.brand_extracted || "—"} · {item.volume_extracted_ml ? `${item.volume_extracted_ml}ml` : "—"}</span>
                </div>
              </div>

              {/* Sugestões de Candidatos */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Possíveis Correspondências Sugeridas:
                </h4>

                {item.suggestions.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-lg">
                    Nenhum candidato sugerido automaticamente. Cadastre este produto no Catálogo Oficial para liberar o vínculo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {item.suggestions.map((sug) => {
                      const mp = sug.master_product;
                      const confidencePct = Math.round(sug.confidence * 100);
                      const isHighConf = confidencePct >= 90;

                      return (
                        <div
                          key={sug.id}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-blue-500/50 transition group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                                  isHighConf
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                }`}
                              >
                                {confidencePct}% Relevância
                              </span>
                              <span className="text-xs text-slate-500 font-mono">#{sug.rank}</span>
                            </div>

                            <div className="flex items-center gap-3 mb-2">
                              {mp.images[0]?.url ? (
                                <img
                                  src={mp.images[0].url}
                                  alt={mp.name}
                                  className="w-10 h-10 object-contain rounded bg-slate-900 p-1 border border-slate-800"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center text-xs text-slate-600">
                                  🍺
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-white text-sm line-clamp-1">
                                  {mp.name}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {mp.brand} · {mp.package_type} {mp.unit_volume_ml}ml
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleApprove(item.id, mp.id)}
                            disabled={approvingId === item.id}
                            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <span>✓ Aprovar Correspondência</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
