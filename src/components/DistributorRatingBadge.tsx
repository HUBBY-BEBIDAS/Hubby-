"use client";

import { useState } from "react";
import { Star, Info, X, Zap, Clock, ShieldCheck } from "lucide-react";

interface DistributorRatingBadgeProps {
  rating?: number | null;
  reviewCount?: number;
  size?: "sm" | "md";
}

export function DistributorRatingBadge({
  rating,
  reviewCount = 0,
  size = "sm",
}: DistributorRatingBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const displayRating = rating && rating > 0 ? rating.toFixed(1) : "5.0";
  const hasReviews = reviewCount > 0;

  return (
    <>
      {/* Badge com Estrela e Ícone de Informação (i) */}
      <div className="inline-flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-50 font-bold text-amber-800 border border-amber-200/80 ${
            size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
          }`}
          title="Nota da Distribuidora"
        >
          <Star size={size === "md" ? 13 : 11} className="fill-amber-400 text-amber-400" />
          <span>{displayRating}</span>
          <span className="text-[10px] font-medium text-amber-600">
            ({hasReviews ? reviewCount : "Novo"})
          </span>
        </span>

        {/* Botão de Informação (i) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-[#2563EB] hover:text-white transition-colors"
          title="Como a nota é calculada?"
          aria-label="Informações sobre a nota da distribuidora"
        >
          <Info size={11} className="stroke-[2.5]" />
        </button>
      </div>

      {/* Modal explicativo ao clicar no botão (i) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fechar */}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X size={18} />
            </button>

            {/* Cabeçalho */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <Star size={20} className="fill-amber-400 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Nota da Distribuidora</h3>
                <p className="text-xs text-slate-500">Como a avaliação é calculada no Hubby</p>
              </div>
            </div>

            <p className="mb-4 text-xs text-slate-600 leading-relaxed">
              A nota da distribuidora (de 1 a 5 estrelas) mede a confiabilidade e o nível de serviço prestado aos compradores na plataforma.
            </p>

            {/* Pilares da Nota */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Zap size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Tempo de Resposta no Chat</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Quão rápido a distribuidora responde as dúvidas e negociações dos clientes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Agilidade na Aprovação do Pedido</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tempo médio gasto para analisar, aceitar ou aprovar cotações recebidas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Pontualidade e Atendimento</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Avaliações dos compradores sobre pontualidade de entrega e pós-venda.
                  </p>
                </div>
              </div>
            </div>

            {/* Ação */}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-5 w-full rounded-2xl bg-[#0F172A] py-3 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
