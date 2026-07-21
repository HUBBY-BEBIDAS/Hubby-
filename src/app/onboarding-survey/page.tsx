"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { CLIENT_ONBOARDING_QUESTIONS, DISTRIBUTOR_ONBOARDING_QUESTIONS } from "@/lib/onboarding";

export default function OnboardingSurveyPage() {
  const { data: session, update } = useSession({ required: true });
  const router = useRouter();
  const token = useApiToken();

  const role = (session?.user as any)?.role ?? "client";
  const steps: any[] = ["distributor_admin", "distributor_collaborator"].includes(role)
    ? DISTRIBUTOR_ONBOARDING_QUESTIONS
    : CLIENT_ONBOARDING_QUESTIONS;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  const currentStep = steps[currentStepIndex];
  const progressPct = Math.round((currentStepIndex / steps.length) * 100);

  // Manipulador de seleção de opções
  const handleSelectOption = (option: string) => {
    const key = currentStep.key;
    const currentVal = answers[key];

    if (currentStep.type === "single") {
      setAnswers((prev) => ({ ...prev, [key]: option }));
    } else {
      const arr = Array.isArray(currentVal) ? currentVal : [];
      if (arr.includes(option)) {
        setAnswers((prev) => ({ ...prev, [key]: arr.filter((x) => x !== option) }));
      } else {
        if (currentStep.maxChoices && arr.length >= currentStep.maxChoices) {
          // Limita seleção se atingir máximo
          return;
        }
        setAnswers((prev) => ({ ...prev, [key]: [...arr, option] }));
      }
    }
  };

  const isNextDisabled = () => {
    const val = answers[currentStep.key];
    if (!val) return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  };

  const handleNext = () => {
    if (isNextDisabled()) return;
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      const res = await apiFetch("/api/users/onboarding", {
        method: "POST",
        token,
        body: JSON.stringify({ responses: answers }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao salvar questionário");
      }

      // Atualiza a sessão NextAuth para incluir o onboarding atualizado
      await update();

      // Redireciona o usuário para o painel principal
      router.push("/painel");
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (showWelcome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start bg-[#F5F7FB] px-4 py-6">
        {/* Header com Logo */}
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22C55E]">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="8" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="8" y="1" width="5" height="4" rx="1" fill="currentColor" />
              <rect x="8" y="7" width="5" height="6" rx="1" fill="currentColor" opacity="0.7" />
            </svg>
          </span>
          <span className="text-sm font-black uppercase tracking-[0.2em] text-[#0F172A]">HUBBY</span>
        </div>

        <div className="w-full max-w-xl">
          {/* Card de Boas-vindas */}
          <div className="rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm transition-all duration-300 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#22C55E]/10 text-[#22C55E] text-2xl font-bold">
              💡
            </div>
            <h2 className="text-[20px] font-bold leading-tight text-[#0F172A] sm:text-[22px]">
              Vamos personalizar sua experiência!
            </h2>
            <p className="mt-4 text-xs font-medium text-slate-500 leading-relaxed">
              Para garantir uma experiência incrível e sob medida na nossa plataforma, preparamos um rápido questionário de 1 minuto. Usaremos suas respostas para exibir gráficos, recomendações e métricas 100% personalizadas de acordo com as necessidades do seu perfil.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="w-full rounded-xl bg-[#22C55E] py-2.5 text-sm font-bold text-white shadow-lg shadow-green-500/10 hover:bg-green-600 active:scale-[0.98] transition-all"
              >
                Começar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[#F5F7FB] px-4 py-6">
      {/* Header com Logo */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22C55E]">
          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="8" rx="1" fill="currentColor" opacity="0.9" />
            <rect x="8" y="1" width="5" height="4" rx="1" fill="currentColor" />
            <rect x="8" y="7" width="5" height="6" rx="1" fill="currentColor" opacity="0.7" />
          </svg>
        </span>
        <span className="text-sm font-black uppercase tracking-[0.2em] text-[#0F172A]">HUBBY</span>
      </div>

      <div className="w-full max-w-xl">
        {/* Barra de Progresso */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Passo {currentStepIndex + 1} de {steps.length}
            </span>
            <span className="font-mono text-[12px] font-bold text-slate-500">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#DBEAFE]">
            <div
              className="h-1.5 rounded-full bg-[#22C55E] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Card do Pergunta Wizard */}
        <div className="rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm transition-all duration-300">
          <h2 className="text-[18px] font-bold leading-tight text-[#0F172A] sm:text-[20px]">
            {currentStep.title}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-400 leading-relaxed">
            {currentStep.subtitle}
          </p>

          {/* Opções de Respostas */}
          <div className="mt-4 flex flex-col gap-2">
            {currentStep.options.map((optOption: any) => {
              const opt = typeof optOption === "string" ? optOption : optOption.text;
              const val = answers[currentStep.key];
              const isSelected = Array.isArray(val) ? val.includes(opt) : val === opt;

              return (
                <button
                  key={opt}
                  onClick={() => handleSelectOption(opt)}
                  className={`flex items-center justify-between rounded-xl border-2 px-4 py-2.5 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-[#22C55E] bg-green-50/40 text-[#16A34A]"
                      : "border-[#DBEAFE] bg-[#F5F7FB] text-[#0F172A] hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm font-semibold">{opt}</span>
                  <div
                    className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      isSelected
                        ? "border-[#22C55E] bg-[#22C55E] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-center text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Mensagem especial no último card */}
          {currentStepIndex === steps.length - 1 && (
            <div className="mt-4 rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/20 p-3 text-center text-xs font-semibold text-[#16A34A]">
              Estas perguntas servem para construir uma experiência personalizada, focada 100% nas suas necessidades na plataforma.
            </div>
          )}

          {/* Navegação */}
          <div className="mt-6 flex gap-3 border-t border-[#DBEAFE] pt-4">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <ChevronLeft size={16} /> Voltar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled() || saving}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                isNextDisabled()
                  ? "bg-slate-300 shadow-none pointer-events-none"
                  : "bg-[#22C55E] shadow-green-500/10 hover:bg-green-600"
              }`}
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : currentStepIndex === steps.length - 1 ? (
                "Finalizar"
              ) : (
                <>
                  Continuar <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
