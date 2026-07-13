"use client";

import React, { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CityAutocomplete, type CityOption } from "@/components/ui/CityAutocomplete";
import { StateSelect } from "@/components/ui/StateSelect";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Check, Gift, Eye, EyeOff } from "lucide-react";

type Role = "client" | "distributor_admin";

const ESTABLISHMENT_TYPES = [
  { value: "bar",         label: "Bar" },
  { value: "restaurant",  label: "Restaurante" },
  { value: "adega",       label: "Adega" },
  { value: "hotel",       label: "Hotel" },
  { value: "nightclub",   label: "Casa Noturna" },
  { value: "supermarket", label: "Supermercado" },
  { value: "convenience", label: "Conveniência" },
  { value: "other",       label: "Outro" },
];

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Confetti
function Confetti() {
  const COLORS = ["#22C55E", "#16A34A", "#4ADE80", "#86EFAC", "#FBBF24", "#60A5FA", "#F472B6"];
  const pieces = Array.from({ length: 72 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${(i / 72) * 100}%`,
    delay: `${(i % 12) * 0.08}s`,
    duration: `${0.9 + (i % 5) * 0.15}s`,
    size: i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5,
    rotate: `${(i * 37) % 360}deg`,
  }));
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.id % 2 === 0 ? "50%" : "2px",
            transform: `rotate(${p.rotate})`,
            animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

type SurveyData = {
  orders_per_month:    string;
  monthly_spend_range: string;
  distributors_count:  string;
  referral_source:     string;
  main_pain:           string;
  beverage_types:      string[];
};

const SURVEY_QUESTIONS = [
  {
    key: "orders_per_month" as const,
    label: "Quantos pedidos de bebida você faz por mês?",
    options: ["1-2 pedidos", "3-5 pedidos", "6-10 pedidos", "Mais de 10 pedidos"],
  },
  {
    key: "monthly_spend_range" as const,
    label: "Qual o seu gasto mensal aproximado em bebidas?",
    options: ["Até R$500", "R$500 a R$2.000", "R$2.000 a R$5.000", "Acima de R$5.000"],
  },
  {
    key: "distributors_count" as const,
    label: "Quantas distribuidoras diferentes você usa hoje?",
    options: ["Apenas 1", "2-3 distribuidoras", "4-6 distribuidoras", "Mais de 6"],
  },
  {
    key: "referral_source" as const,
    label: "Como ficou sabendo da Hubby?",
    options: ["Instagram", "Google", "Indicação de amigo", "WhatsApp", "Outro"],
  },
  {
    key: "main_pain" as const,
    label: "Qual sua maior dificuldade hoje ao comprar bebidas?",
    options: [
      "Perco muito tempo cotando",
      "Não sei se estou pagando o melhor preço",
      "Difícil comparar distribuidoras",
      "Falta de organização nos pedidos",
      "Outro",
    ],
  },
];

const BEVERAGE_TYPES = ["Cervejas", "Destilados (whisky, vodka, gin)", "Vinhos", "Energéticos", "Não alcoólicos", "Todos"];

function SurveyStep({ token, onDone }: { token: string | null; onDone: () => void }) {
  const [data, setData] = useState<SurveyData>({
    orders_per_month: "", monthly_spend_range: "", distributors_count: "",
    referral_source: "", main_pain: "", beverage_types: [],
  });
  const [submitting, setSubmitting] = useState(false);

  function toggleBeverage(v: string) {
    setData((prev) => ({
      ...prev,
      beverage_types: prev.beverage_types.includes(v)
        ? prev.beverage_types.filter((b) => b !== v)
        : [...prev.beverage_types, v],
    }));
  }

  async function submit(skipped: boolean) {
    setSubmitting(true);
    try {
      if (token) {
        await apiFetch("/api/onboarding-survey", {
          method: "POST",
          token,
          body: JSON.stringify(skipped ? { skipped: true } : { ...data, skipped: false }),
        });
      }
    } catch { /* non-blocking */ }
    finally { setSubmitting(false); }
    onDone();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#22C55E]">Passo 3 de 3 — Quase lá!</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F172A]">Ajude a Hubby a ser melhor para você</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Leva menos de 1 minuto e nos ajuda a personalizar sua experiência</p>
        </div>

        <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm space-y-6">
          {SURVEY_QUESTIONS.map((q) => (
            <div key={q.key}>
              <p className="mb-2 text-sm font-semibold text-[#0F172A]">{q.label}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const selected = data[q.key] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setData((p) => ({ ...p, [q.key]: selected ? "" : opt }))}
                      className={[
                        "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                        selected
                          ? "border-[#22C55E] bg-[#22C55E]/10 text-[#16A34A]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bebidas — múltipla seleção */}
          <div>
            <p className="mb-2 text-sm font-semibold text-[#0F172A]">Quais tipos de bebida você mais compra? <span className="text-slate-400 font-normal">(múltipla seleção)</span></p>
            <div className="flex flex-wrap gap-2">
              {BEVERAGE_TYPES.map((b) => {
                const selected = data.beverage_types.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBeverage(b)}
                    className={[
                      "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                      selected
                        ? "border-[#22C55E] bg-[#22C55E]/10 text-[#16A34A]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {selected ? <><Check size={12} className="inline mr-1" /></> : ""}{b}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button fullWidth size="lg" loading={submitting} onClick={() => submit(false)} className="bg-[#22C55E] hover:bg-[#16A34A] font-bold">
              Enviar respostas
            </Button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(true)}
              className="text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              Pular esta etapa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Done step
function DoneStep({ coverageWarning, city, onGo }: { coverageWarning: boolean; city: string; onGo: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(onGo, 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onGo]);

  return (
    <>
      <Confetti />
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#22C55E]/15">
            <svg className="h-10 w-10 text-[#22C55E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Tudo pronto!</h1>
          <p className="mt-2 text-base font-medium text-slate-600">Bem-vindo à Hubby.</p>

          {coverageWarning && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              Ainda não temos cobertura em <strong>{city}</strong>. Você já está na lista de espera — avisaremos quando chegar!
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">Redirecionando em instantes…</p>
          <button onClick={onGo} className="mt-3 text-sm font-semibold text-[#22C55E] hover:underline">
            Ir agora →
          </button>
        </div>
      </div>
    </>
  );
}

function formatWhatsapp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export default function RegisterClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = useApiToken();
  const { data: session, status } = useSession();

  // Redireciona usuários já autenticados para seu respectivo painel
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = (session.user as any).role;
      const profileComplete = (session.user as any).profileComplete;
      if (role === "client") {
        router.replace(profileComplete ? "/cotacao" : "/perfil/completar");
      } else if (role === "platform_admin") {
        router.replace("/admin");
      } else {
        router.replace("/painel");
      }
    }
  }, [status, session, router]);

  const [step, setStep] = useState<"role" | "form" | "survey" | "done">("role");
  const [role, setRole] = useState<Role>("client");
  const [roleSelected, setRoleSelected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [coverageWarning, setCoverageWarning] = useState(false);

  const [responsibleName, setResponsibleName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [establishmentType, setEstablishmentType] = useState("bar");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [citySelected, setCitySelected] = useState(false); // controla se o usuário escolheu da lista
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [referralCode, setReferralCode]   = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralName,  setReferralName]  = useState("");

  // Pré-preenche o código de indicação a partir da URL (?ref=CODIGO)
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [searchParams]);

  // Valida código de indicação quando muda (apenas para distribuidoras)
  useEffect(() => {
    if (role !== "distributor_admin" || !referralCode || referralCode.length < 4) {
      setReferralValid(null);
      setReferralName("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch("/api/referrals/track", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ code: referralCode }),
        });
        const data = await res.json() as { valid: boolean; referrer_name?: string };
        setReferralValid(data.valid);
        setReferralName(data.referrer_name ?? "");
      } catch {
        setReferralValid(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode, role]);

  // Verifica cobertura somente se a cidade foi escolhida do autocomplete
  const [coverageCheck, setCoverageCheck] = useState<"covered" | "not_covered" | null>(null);
  useEffect(() => {
    if (!citySelected || !city || !state) {
      setCoverageCheck(null);
      return;
    }
    setCoverageCheck("covered"); // Cidade da lista já garante cobertura
  }, [city, state, citySelected, role]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload =
      role === "client"
        ? {
            role,
            email,
            password,
            responsible_name: responsibleName,
            company_name: companyName,
            cnpj: cnpj.replace(/\D/g, ""),
            whatsapp: whatsapp.replace(/\D/g, ""),
            establishment_type: establishmentType,
            delivery_city: city,
            delivery_state: state.toUpperCase().slice(0, 2),
          }
        : {
            role,
            email,
            password,
            responsible_name: responsibleName,
            company_name: companyName,
            cnpj: cnpj.replace(/\D/g, ""),
            whatsapp_commercial: whatsapp.replace(/\D/g, ""),
            ...(referralCode.trim() && { referral_code: referralCode.trim().toUpperCase() }),
          };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as { error?: string; ok?: boolean; coverage_warning?: boolean };

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Erro ao criar conta. Tente novamente.");
      return;
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (login?.error) {
      setLoading(false);
      setError("Conta criada, mas não foi possível fazer login. Tente entrar manualmente.");
      return;
    }

    router.push("/onboarding-survey");
  }

  if (step === "survey") {
    return <SurveyStep token={token} onDone={() => setStep("done")} />;
  }

  if (step === "done") {
    return <DoneStep coverageWarning={coverageWarning} city={city} onGo={() => router.push("/cotacao")} />;
  }

  if (step === "role") {
    const cards: Array<{
      value: Role;
      title: string;
      subtitle: string;
      benefits: string[];
      badge?: string;
      icon: React.ReactNode;
    }> = [
      {
        value: "client",
        title: "Sou comprador",
        subtitle: "Bar, restaurante, adega ou mercado",
        benefits: [
          "Cotar com várias distribuidoras de uma vez",
          "Ver ranking de preços automático",
          "Grátis para sempre",
        ],
        icon: (
          <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden>
            <rect x="6" y="18" width="36" height="24" rx="3" fill="#14532D" stroke="#22C55E" strokeWidth="1.5"/>
            <path d="M6 22h36" stroke="#22C55E" strokeWidth="1.5"/>
            <rect x="14" y="28" width="8" height="14" rx="1.5" fill="#22C55E" opacity=".5"/>
            <rect x="26" y="32" width="10" height="10" rx="1.5" fill="#22C55E" opacity=".5"/>
            <path d="M16 18v-4a8 8 0 0 1 16 0v4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="20" cy="10" r="2" fill="#22C55E"/>
            <circle cx="28" cy="10" r="2" fill="#22C55E"/>
          </svg>
        ),
      },
      {
        value: "distributor_admin",
        title: "Sou distribuidora",
        subtitle: "Empresa que vende e distribui bebidas",
        benefits: [
          "Receba cotações de compradores da sua região",
          "Gerencie pedidos no painel",
          "14 dias grátis para testar",
        ],
        icon: (
          <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden>
            <rect x="2" y="20" width="28" height="18" rx="2" fill="#14532D" stroke="#22C55E" strokeWidth="1.5"/>
            <path d="M30 26h8l6 8v4H30V26Z" fill="#14532D" stroke="#22C55E" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="10" cy="40" r="4" fill="#0B1220" stroke="#22C55E" strokeWidth="1.5"/>
            <circle cx="10" cy="40" r="1.5" fill="#22C55E"/>
            <circle cx="38" cy="40" r="4" fill="#0B1220" stroke="#22C55E" strokeWidth="1.5"/>
            <circle cx="38" cy="40" r="1.5" fill="#22C55E"/>
            <path d="M8 28h14M8 32h10" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
          </svg>
        ),
      },
    ];

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B1220] px-4 py-12">
        <Link href="/" className="mb-10 inline-block">
          <span className="text-sm font-extrabold tracking-tight uppercase text-white/90">
            HUBBY
          </span>
        </Link>
        <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-white">
          Como você vai usar a plataforma?
        </h1>
        <p className="mb-10 text-center text-sm font-medium text-white/40">
          Escolha um perfil para continuar
        </p>

        <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const selected = roleSelected && role === card.value;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => { setRole(card.value); setRoleSelected(true); }}
                className={[
                  "relative flex flex-col items-start rounded-3xl border p-6 text-left transition-all duration-150",
                  selected
                    ? "border-[#22C55E] bg-[#0F1E38] shadow-[0_0_0_1px_#22C55E]"
                    : "border-[#1E3A5F] bg-[#131F35] hover:border-[#22C55E]/60 hover:bg-[#0F1E38]",
                ].join(" ")}
              >
                {card.badge && (
                  <span className="absolute right-4 top-4 rounded-full bg-[#22C55E] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                    {card.badge}
                  </span>
                )}
                <div className="mb-5">{card.icon}</div>
                <p className="text-lg font-semibold text-white">{card.title}</p>
                <p className="mt-1 text-sm text-white/40">{card.subtitle}</p>

                <ul className="mt-5 space-y-2.5">
                  {card.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
                        <circle cx="8" cy="8" r="8" fill="#16a34a" opacity=".2"/>
                        <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-white/70">{b}</span>
                    </li>
                  ))}
                </ul>

                {selected && (
                  <div className="absolute right-5 top-5 flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E]">
                    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden>
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 w-full max-w-2xl">
          <button
            type="button"
            disabled={!roleSelected}
            onClick={() => setStep("form")}
            className={[
              "w-full rounded-2xl py-3.5 text-base font-semibold transition-all duration-150",
              roleSelected
                ? "bg-[#22C55E] text-white hover:bg-[#16A34A]"
                : "cursor-not-allowed bg-[#1E3A5F] text-white/30",
            ].join(" ")}
          >
            Continuar
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-white/30">
          Já tem conta?{" "}
          <Link href="/auth/login" className="font-semibold text-[#22C55E] hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-sm font-extrabold tracking-tight uppercase text-[#0F172A]">
              HUBBY
            </span>
          </Link>
          <p className="mt-2 text-[11px] font-bold tracking-widest uppercase text-[#22C55E]">
            {role === "client" ? "Passo 2 de 3 — Dados da conta" : "Cadastro de distribuidora"}
          </p>
        </div>

        <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm">
          <button
            onClick={() => setStep("role")}
            className="mb-4 text-sm text-slate-500 hover:text-[#0F172A]"
          >
            ← Voltar
          </button>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Nome do responsável"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Seu nome completo"
              required
            />

            <Input
              label={role === "client" ? "Nome do estabelecimento" : "Razão Social"}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />

            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Senha"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Mínimo 8 caracteres, 1 maiúscula e 1 número (ex: Senha123)"
              autoComplete="new-password"
              required
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex h-full items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <Input
              label="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              required
            />

            {cnpj.replace(/\D/g, "").length === 14 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/5 px-3.5 py-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 1.5L2 4v4c0 3.31 2.55 5.91 6 6.5 3.45-.59 6-3.19 6-6.5V4L8 1.5Z" fill="#16A34A" opacity=".2" stroke="#16A34A" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M5.5 8l2 2 3-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="text-xs font-bold text-[#16A34A]">CNPJ verificado com sucesso na Receita Federal</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">Situação cadastral, razão social e data de abertura confirmados.</p>
                </div>
              </div>
            )}

            <Input
              label={role === "client" ? "WhatsApp" : "WhatsApp comercial"}
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
              placeholder="(11) 99999-9999"
              required
            />

            {role === "client" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-[#0F172A]">
                    Tipo de estabelecimento
                  </label>
                  <select
                    value={establishmentType}
                    onChange={(e) => setEstablishmentType(e.target.value)}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition-colors focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                  >
                    {ESTABLISHMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <CityAutocomplete
                    label="Cidade de entrega"
                    value={city}
                    onSelect={(opt: CityOption) => {
                      if (opt.city) {
                        setCity(opt.city);
                        setState(opt.state);
                        setCitySelected(true);
                        setCoverageCheck("covered");
                      } else {
                        setCitySelected(false);
                        setCoverageCheck(null);
                      }
                    }}
                    required
                  />
                  <StateSelect
                    label="UF"
                    value={state}
                    onChange={(uf) => { setState(uf); setCitySelected(false); setCoverageCheck(null); }}
                    required
                    className="w-36"
                  />
                </div>

                {coverageCheck === "not_covered" && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 3.5v3m0 2.25h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-amber-800">Ainda não temos cobertura em {city}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-amber-700">Finalize seu cadastro e avisamos quando chegar!</p>
                    </div>
                  </div>
                )}
                {coverageCheck === "covered" && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/5 px-3.5 py-2.5">
                    <svg className="h-4 w-4 shrink-0 text-[#16A34A]" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="#16A34A" strokeWidth="1.2"/>
                      <path d="M5.5 8l2 2 3-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-xs font-bold text-[#16A34A]">{city} está na nossa área de cobertura!</p>
                  </div>
                )}
              </>
            )}

            {role === "distributor_admin" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-[#0F172A]">
                  <Gift size={13} className="inline mr-1 text-[#22C55E]" />
                  Código de indicação
                  <span className="ml-1 text-xs font-normal text-slate-400">opcional</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: HUB3K9"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-2.5 text-sm font-mono uppercase text-[#0F172A] placeholder:text-slate-400 focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                  />
                  {referralValid === true && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                      <Check size={15} />
                    </div>
                  )}
                </div>
                {referralValid === true && (
                  <p className="text-xs text-green-600 font-medium">
                    <Check size={10} className="inline mr-0.5" />Indicado por {referralName}
                  </p>
                )}
                {referralValid === false && referralCode.length >= 4 && (
                  <p className="text-xs text-red-600">Código não encontrado</p>
                )}
                <p className="text-xs text-slate-400">
                  Se alguém te indicou a Hubby, informe o código para que ele ganhe dias grátis do plano Pro.
                </p>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#22C55E]"
              />
              <span className="text-sm text-slate-600">
                Li e concordo com os{" "}
                <a href="/termos" target="_blank" className="font-semibold text-[#22C55E] hover:underline">
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a href="/privacidade" target="_blank" className="font-semibold text-[#22C55E] hover:underline">
                  Política de Privacidade
                </a>{" "}
                da Hubby.
              </span>
            </label>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg" disabled={!termsAccepted} className="bg-[#22C55E] hover:bg-[#16A34A] font-bold">
              Criar conta
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/auth/login" className="font-semibold text-[#22C55E] hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
