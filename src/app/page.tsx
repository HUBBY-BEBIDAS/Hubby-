"use client";

import { useState, useEffect, useRef } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import { Check, Star, Calendar, Sparkles } from "lucide-react";
// ─── Tabela de preços ─────────────────────────────────────────────────────────

type PeriodKey = "monthly" | "quarterly" | "semiannual" | "annual";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual",
};
const PERIOD_MONTHS: Record<PeriodKey, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
};
const DIST_MONTHLY: Record<string, Record<PeriodKey, number>> = {
  starter:  { monthly: 29900, quarterly: 26900, semiannual: 25400, annual: 23900 },
  pro:      { monthly: 79900, quarterly: 71900, semiannual: 67900, annual: 63900 },
  business: { monthly: 149900, quarterly: 134900, semiannual: 127400, annual: 119900 },
};
const DIST_TOTAL: Record<string, Record<PeriodKey, number>> = {
  starter:  { monthly: 29900, quarterly: 80700,  semiannual: 152400,  annual: 286800  },
  pro:      { monthly: 79900, quarterly: 215700, semiannual: 407400,  annual: 766800  },
  business: { monthly: 149900, quarterly: 404700, semiannual: 764400, annual: 1438800 },
};
const BUYER_MONTHLY: Record<PeriodKey, number> = {
  monthly: 9900, quarterly: 8900, semiannual: 8400, annual: 7900,
};
const BUYER_TOTAL: Record<PeriodKey, number> = {
  monthly: 9900, quarterly: 26700, semiannual: 50400, annual: 94800,
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
}

// ─── Dados ────────────────────────────────────────────────────────────────────

const clientTypes = ["Bar", "Restaurante", "Adega", "Hotel", "Mercado", "Casa Noturna", "Conveniência", "Evento"];

const testimonials = [
  { name: "Carlos M.",    role: "Gerente de Compras", company: "Bar & Grill SP",          stars: 5, text: "Antes eu gastava meia manhã no telefone pedindo cotação. Agora mando uma vez e recebo tudo comparado automaticamente. Economizei mais de R$ 800 no primeiro mês." },
  { name: "Ana Paula R.", role: "Proprietária",        company: "Adega do Centro",         stars: 5, text: "Consegui fechar com uma distribuidora que nem conhecia. O ranking mostrou um preço 18% menor no gin importado. Nunca mais volto ao modelo antigo." },
  { name: "Roberto S.",   role: "Sócio-Gerente",       company: "Restaurante Mediterrâneo",stars: 5, text: "O processo de credenciamento foi rápido e transparente. Em menos de 48 horas eu já estava comprando de 3 distribuidoras novas com condições muito melhores." },
];

const faqsCompradores = [
  { q: "Quanto custa para o comprador?", a: "O plano básico é gratuito para sempre. Você cota, compara preços e envia pedidos sem pagar nada. Se quiser expandir para outras regiões, ter múltiplos usuários ou acessar relatórios avançados, temos o plano Pro a partir de R$ 79/mês no plano anual." },
  { q: "Preciso instalar algum aplicativo?", a: "Não — a plataforma funciona direto pelo navegador do celular ou computador. O app para iOS e Android está em desenvolvimento e chegará em breve." },
  { q: "Como as distribuidoras sabem que sou confiável?", a: "Quando você aciona uma distribuidora pela primeira vez, o sistema faz uma análise de crédito automática pelo seu CNPJ via bureau de crédito (Serasa). O resultado vai para a distribuidora, que decide se aprova ou não. Você só precisa enviar seus documentos uma vez." },
  { q: "Quanto tempo leva para receber as cotações?", a: "O ranking de preços aparece instantaneamente — as distribuidoras já cadastram seus preços na plataforma. Você não precisa esperar ninguém responder para ver os valores." },
  { q: "A Hubby cobra comissão por venda?", a: "Nunca. A Hubby cobra mensalidade apenas das distribuidoras. Para o comprador, o plano básico é gratuito para sempre e não há comissão sobre nenhuma venda." },
  { q: "Como funciona o pagamento e a nota fiscal?", a: "O pagamento e a nota fiscal são negociados diretamente entre você e a distribuidora escolhida. A Hubby faz a ponte — mas não intermedia o pagamento nem emite notas fiscais." },
  { q: "Posso cotar com distribuidoras de outras cidades?", a: "No plano gratuito, você cota com distribuidoras que atendem sua região cadastrada. No plano Pro, você pode expandir para qualquer região do Brasil." },
];

const faqsDistribuidoras = [
  { q: "Como recebo as cotações dos clientes?", a: "De três formas simultâneas: notificação no painel da plataforma, mensagem no WhatsApp comercial cadastrado e e-mail comercial. Você escolhe como prefere ser notificado." },
  { q: "Preciso atualizar meus preços toda hora?", a: "Não. Você atualiza quando quiser — pode ser diário, semanal ou quando houver mudança. O sistema exibe para o comprador a data e hora da última atualização, garantindo transparência." },
  { q: "O que acontece se eu não tiver um produto em estoque?", a: "Você desativa o produto com um clique e ele some do ranking instantaneamente. No plano Enterprise, você pode integrar seu ERP para sincronizar o estoque automaticamente." },
  { q: "Como funciona a análise de crédito dos clientes?", a: "Quando um cliente novo te aciona pela primeira vez, o sistema consulta automaticamente o bureau de crédito pelo CNPJ dele. Você vê o score e decide se aprova ou não. Você também pode configurar critérios próprios de aprovação automática." },
  { q: "Posso escolher quais regiões atendo?", a: "Sim. Você configura exatamente as cidades e estados que atende, os dias de rota e o horário de corte para cada região. O sistema filtra automaticamente — seu perfil só aparece para compradores da sua área de entrega." },
  { q: "Existe fidelidade ou contrato mínimo?", a: "Não há fidelidade obrigatória. Você pode assinar mensalmente e cancelar quando quiser. Oferecemos planos trimestrais, semestrais e anuais com desconto de até 20% para quem prefere um compromisso maior." },
  { q: "A Hubby cobra comissão por venda fechada?", a: "Nunca. Você paga apenas a mensalidade do plano escolhido. Não importa quantos pedidos você fechar pela plataforma — nenhuma comissão é cobrada." },
  { q: "Posso integrar com meu sistema de gestão (ERP)?", a: "Sim, no plano Enterprise. A integração é feita via webhook e API própria — quando um pedido chega, seu ERP é notificado automaticamente. Você também pode sincronizar o estoque em tempo real." },
];

// ─── Componentes ──────────────────────────────────────────────────────────────

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    const el = ref.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`border-b border-slate-200 ${index === 0 ? "border-t" : ""}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer select-none items-start justify-between gap-4 py-5 text-left touch-manipulation"
      >
        <span className={`text-[15px] font-medium leading-snug transition-colors ${open ? "text-[#22C55E]" : "text-[#0F172A]"}`}>
          {q}
        </span>
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${open ? "border-[#22C55E] bg-[#22C55E] text-black rotate-45" : "border-slate-300 bg-white text-[#22C55E]"}`}
          style={{ fontSize: "18px", lineHeight: 1 }}
        >
          +
        </span>
      </button>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? (bodyRef.current?.scrollHeight ?? 500) + "px" : "0px" }}
      >
        <p className="pb-5 text-[15px] leading-[1.65] text-slate-600">{a}</p>
      </div>
    </div>
  );
}

function FaqSection() {
  const [tab, setTab] = useState<"compradores" | "distribuidoras">("compradores");
  const items = tab === "compradores" ? faqsCompradores : faqsDistribuidoras;

  return (
    <section id="faq" className="bg-[#F8FAFC] py-16 lg:py-20">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Dúvidas frequentes</span>
          <h2 className="mt-3 font-display text-4xl font-bold text-[#0F172A]">Perguntas frequentes</h2>
        </div>

        <div className="mb-8 flex rounded-xl border border-slate-200 bg-white p-1">
          {(["compradores", "distribuidoras"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "flex-1 min-h-[44px] cursor-pointer select-none rounded-lg py-2.5 text-sm font-semibold touch-manipulation transition-all duration-200",
                tab === t ? "bg-[#22C55E] text-black shadow-sm" : "text-slate-600 hover:text-[#0F172A]",
              ].join(" ")}
            >
              {t === "compradores" ? "Para compradores" : "Para distribuidoras"}
            </button>
          ))}
        </div>

        <div key={tab}>
          {items.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} index={i} />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-5 sm:flex-row">
          <span className="text-sm text-slate-600">Não encontrou sua resposta?</span>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Falar pelo WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Home() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("monthly");

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="overflow-hidden">
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { display: flex; width: max-content; animation: marquee 26s linear infinite; will-change: transform; }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes hero-orb { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.20; transform: scale(1.06); } }
        .hero-orb-green { animation: hero-orb 7s ease-in-out infinite; }
        .hero-orb-blue  { animation: hero-orb 9s ease-in-out infinite 2.5s; }
      `}</style>

      <SiteNavbar trackSections />

      <div className="bg-[#0D1117]">

        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <section className="relative bg-[#0D1117] text-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="hero-orb-green absolute -top-40 right-[-10%] h-[640px] w-[640px] rounded-full bg-[#22C55E]" style={{ filter: "blur(130px)" }} />
            <div className="hero-orb-blue absolute -bottom-20 left-[-8%] h-[520px] w-[520px] rounded-full bg-[#3B82F6]" style={{ filter: "blur(110px)" }} />
            <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:48px_48px]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pt-28 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8">

            {/* Texto */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#22C55E]/40 bg-[#22C55E]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#4ADE80]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#22C55E]" />
                Plataforma B2B de Cotação de Bebidas
              </span>

              <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-[64px]">
                Cotação de bebidas{" "}
                <span className="text-[#22C55E]">inteligente.</span>
                <br />
                Do pedido ao ranking{" "}
                <span className="text-white/50">em segundos.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-[1.65] text-slate-400 md:text-lg">
                Distribuidoras cadastram preços uma vez. Compradores enviam cotação para múltiplas distribuidoras e veem o ranking automático com prazo real de entrega calculado pela rota.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="/auth/register" className="inline-flex items-center justify-center rounded-lg bg-[#22C55E] px-7 py-3.5 text-base font-bold text-black transition hover:opacity-90">
                  Criar conta grátis
                </a>
                <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/[0.05] px-7 py-3.5 text-base font-medium text-white/80 transition hover:bg-white/10">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">▶</span>
                  Ver como funciona
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/50">
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#22C55E]" /> Grátis para cotar na sua região</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#22C55E]" /> Trial 14 dias para distribuidoras</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#22C55E]" /> Sem comissão por venda</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#22C55E]" /> CNPJ verificado automaticamente</span>
              </div>
            </div>

            {/* Mock UI hero */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[420px]">

                {/* Card cotação */}
                <div
                  className="rounded-[2rem] border border-white/[0.08] bg-[#111827] p-4"
                  style={{ transform: "perspective(1000px) rotateY(-8deg)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
                >
                  <div className="rounded-[1.5rem] bg-[#1a2332] p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Nova Cotação</span>
                      <span className="rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-xs font-bold text-[#22C55E]">4 itens</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {["Heineken Long Neck 330ml × 24", "Jack Daniel's Tennessee 1L × 2", "Absolut Original 1L × 4", "Tanqueray London Dry 1L × 3"].map((item) => (
                        <div key={item} className="flex items-center gap-2 rounded-xl bg-[#0D1117] px-3 py-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                          <span className="text-xs font-medium text-slate-300">{item}</span>
                        </div>
                      ))}
                    </div>
                    <button className="mt-4 w-full rounded-xl bg-[#22C55E] py-2.5 text-sm font-bold text-black">
                      Enviar para 8 distribuidoras →
                    </button>
                  </div>
                </div>

                {/* Card ranking sobreposto */}
                <div className="absolute -bottom-14 -right-4 w-[260px] rounded-[1.5rem] border border-white/[0.08] bg-[#111827] p-3 sm:-right-6 sm:w-[280px]" style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
                  <div className="rounded-xl bg-[#1a2332] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#22C55E]">Ranking de Preços</div>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { name: "Dist. Silva & Cia", price: "R$ 1.240", tag: "Mais barato", best: true  },
                        { name: "Bebidas Norte",     price: "R$ 1.295", tag: "",            best: false },
                        { name: "Atacadão Drink",    price: "R$ 1.380", tag: "Mais rápido", best: false },
                      ].map((d, i) => (
                        <div key={d.name} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${d.best ? "border border-[#22C55E]/30 bg-[#22C55E]/10" : "bg-[#0D1117]"}`}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500">{i + 1}°</span>
                            <span className="text-xs font-bold text-white">{d.name}</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-mono text-xs font-medium ${d.best ? "text-[#22C55E]" : "text-slate-300"}`}>{d.price}</div>
                            {d.tag && <span className="text-[9px] font-bold text-[#22C55E]">{d.tag}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ══ MARQUEE ═══════════════════════════════════════════════════════════ */}
        <section className="overflow-hidden border-y border-slate-200 bg-[#F8FAFC] py-6">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-500">
            Para bares, restaurantes, adegas e muito mais
          </p>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#F8FAFC] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#F8FAFC] to-transparent" />
            <div className="overflow-hidden">
              <div className="marquee-track gap-4">
                {[...clientTypes, ...clientTypes].map((label, i) => (
                  <div key={i} className="flex shrink-0 items-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ COMO FUNCIONA — intro ════════════════════════════════════════════ */}
        <section id="como-funciona" className="bg-[#F8FAFC] pb-10 pt-12 text-center lg:pb-12 lg:pt-12">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Como funciona</span>
            <h2 className="mt-3 font-display text-[40px] font-bold leading-tight text-[#0F172A]">Do produto ao pedido em três passos.</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-[1.65] text-slate-500 md:text-lg">
              Você monta a cotação, a plataforma encontra os melhores preços e você escolhe para quem enviar. Tudo em minutos.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/8 px-4 py-2 text-sm font-semibold text-[#16A34A]">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 1.5L2 4v4c0 3.31 2.55 5.91 6 6.5 3.45-.59 6-3.19 6-6.5V4L8 1.5Z" fill="#16A34A" opacity=".2" stroke="#16A34A" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M5.5 8l2 2 3-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Plataforma com verificação automática de CNPJ — só empresas regulares cotam
            </div>
          </div>
        </section>

        {/* ══ 01 — Monte e cote ════════════════════════════════════════════════ */}
        <section className="bg-[#F8FAFC] pb-16 pt-0 lg:pb-20 lg:pt-0">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">01. Monte e cote</span>
              <h2 className="mt-3 font-display text-[40px] font-bold leading-tight text-[#0F172A]">
                Produtos, prazos e preços de{" "}
                <span className="text-[#22C55E]">todas as distribuidoras lado a lado.</span>
              </h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-slate-600 md:text-base">
                Você adiciona os produtos e o prazo desejado. A plataforma busca todas as distribuidoras da sua região que têm os itens disponíveis e monta a comparação automaticamente.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Busque por produto: Heineken, Jack Daniel's, Absolut…",
                  "Veja o menor preço de cada produto por distribuidora",
                  "Monte o pedido ideal combinando distribuidoras",
                  "Amplie para outras regiões de SP com o plano Pro",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]"><Check size={11} /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup ranking */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
              <div className="border-b border-slate-100 bg-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#0F172A]">Ranking de preços</p>
                  <p className="text-[10px] font-semibold text-slate-500">2 produtos · 3 distribuidoras</p>
                </div>
                <div className="flex gap-1.5">
                  {["Mais barato", "Mais rápido"].map((f) => (
                    <span key={f} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${f === "Mais barato" ? "bg-[#22C55E] text-black" : "border border-slate-200 bg-white text-slate-500"}`}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 p-3">
                {[
                  {
                    name: "Heineken Long Neck 330ml", qty: 24, from: "R$ 4,00/un",
                    offers: [
                      { dist: "Dist. Beta Drinks",     price: "R$ 4,00/un",  total: "R$ 96,00",  date: "quinta 17/04", checked: true,  cheapest: true  },
                      { dist: "Dist. Alpha Bebidas",   price: "R$ 4,20/un",  total: "R$ 100,80", date: "quinta 17/04", checked: false, cheapest: false },
                      { dist: "Dist. Gamma Comercial", price: "R$ 4,50/un",  total: "R$ 108,00", date: "quarta 16/04", checked: false, cheapest: false },
                    ],
                  },
                  {
                    name: "Jack Daniel's Tennessee 1L", qty: 2, from: "R$ 69,90/un",
                    offers: [
                      { dist: "Dist. Beta Drinks",     price: "R$ 69,90/un", total: "R$ 139,80", date: "quinta 17/04", checked: true,  cheapest: true  },
                      { dist: "Dist. Alpha Bebidas",   price: "R$ 72,00/un", total: "R$ 144,00", date: "quinta 17/04", checked: false, cheapest: false },
                      { dist: "Dist. Gamma Comercial", price: "R$ 74,00/un", total: "R$ 148,00", date: "quinta 17/04", checked: false, cheapest: false },
                    ],
                  },
                ].map((product) => (
                  <div key={product.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">{product.name}</p>
                        <p className="text-[11px] font-semibold text-slate-400">Quantidade: {product.qty} un · {product.offers.length} ofertas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-500">A partir de</p>
                        <p className="font-mono text-xs font-extrabold text-[#22C55E]">{product.from}</p>
                      </div>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {product.offers.map((offer) => (
                        <li key={offer.dist} className={`flex items-center gap-2.5 px-4 py-2.5 ${offer.checked ? "bg-[#EFF6FF]" : ""}`}>
                          <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${offer.checked ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300 bg-transparent"}`}>
                            {offer.checked && (
                              <svg className="h-2 w-2 text-white" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <div className="flex flex-1 min-w-0 items-center gap-1.5">
                            <span className={`truncate text-xs font-bold ${offer.checked ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{offer.dist}</span>
                            {offer.cheapest && (
                              <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase text-green-700">Mais barato</span>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-mono text-xs font-extrabold ${offer.checked ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{offer.price}</p>
                            <p className="text-[9px] font-semibold text-slate-400">{offer.date}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 bg-white px-4 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">2 itens selecionados · 1 distribuidora</p>
                  <p className="text-[10px] font-semibold text-slate-500">Total: <span className="font-mono font-extrabold text-[#2563EB]">R$ 235,80</span></p>
                </div>
                <button className="shrink-0 rounded-lg bg-[#22C55E] px-4 py-2 text-[11px] font-bold text-black">Confirmar cotação →</button>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* ══ 02 — Ranking automático ══════════════════════════════════════════ */}
        <section className="bg-[#111827] py-16 text-white lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">

              {/* Mockup sugestão inteligente */}
              <div className="order-2 overflow-hidden rounded-2xl border border-[#22C55E]/20 bg-[#1a2332] lg:order-1" style={{ boxShadow: "0 0 40px rgba(34,197,94,0.08)" }}>
                <div className="px-6 pb-4 pt-6">
                  <span className="rounded-full bg-[#22C55E]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#22C55E]">Sugestão inteligente</span>
                  <h3 className="mt-3 font-display text-[28px] font-bold text-white">Melhor combinação de preços</h3>
                  <p className="mt-1 text-sm leading-[1.65] text-slate-400">O menor preço disponível para cada produto da sua cotação.</p>
                </div>

                <div className="mx-5 mb-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]">
                  {[
                    { product: "Heineken LN 330ml × 24",  dist: "Dist. Beta Drinks",     total: "R$ 96,00",  date: "quarta, 16/04" },
                    { product: "Jack Daniel's 1L × 2",    dist: "Dist. Beta Drinks",     total: "R$ 139,80", date: "quarta, 16/04" },
                    { product: "Absolut Vodka 1L × 4",    dist: "Dist. Alpha Bebidas",   total: "R$ 208,00", date: "quinta, 17/04" },
                    { product: "Tanqueray 1L × 3",         dist: "Dist. Gamma Comercial", total: "R$ 231,00", date: "terça, 15/04"  },
                  ].map((row, i, arr) => (
                    <div key={row.product} className={["flex items-start gap-3 px-4 py-3 text-sm", i < arr.length - 1 ? "border-b border-white/[0.06]" : ""].join(" ")}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{row.product}</p>
                        <p className="text-xs text-slate-500">{row.dist} · <Calendar size={11} className="inline" /> {row.date}</p>
                      </div>
                      <p className="shrink-0 font-mono font-medium text-white">{row.total}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total combinado</p>
                    <p className="font-mono text-2xl font-medium text-[#22C55E]">R$ 674,80</p>
                    <p className="mt-0.5 text-xs text-slate-500">3 distribuidoras · entregas entre 15/04 e 17/04</p>
                  </div>
                  <button className="rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90">
                    Usar esta sugestão →
                  </button>
                </div>
              </div>

              {/* Texto */}
              <div className="order-1 lg:order-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">02. Ranking automático</span>
                <h2 className="mt-3 font-display text-[40px] font-bold leading-tight text-white">
                  Compare preços e prazos{" "}
                  <span className="text-[#22C55E]">lado a lado.</span>
                </h2>
                <p className="mt-4 text-[15px] leading-[1.65] text-slate-400 md:text-base">
                  O ranking é gerado automaticamente com as distribuidoras que atendem sua região, têm o produto disponível e entregam no prazo desejado. Ordenado por menor preço total.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Filtragem automática por região e disponibilidade",
                    "Data de entrega calculada pela rota e horário de corte",
                    "Distribuidoras fora do prazo aparecem com aviso claro",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] text-slate-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]"><Check size={11} /></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-2xl border border-[#22C55E]/20 bg-[#22C55E]/[0.05] p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/20 text-[#22C55E]"><Sparkles size={14} /></span>
                    <div>
                      <p className="text-sm font-bold text-white">Sugestão inteligente</p>
                      <p className="mt-1 text-sm leading-[1.65] text-slate-400">
                        A plataforma monta automaticamente a combinação de menor custo total — escolhendo o melhor preço de cada produto entre todas as distribuidoras disponíveis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 03 — Envie a cotação ═════════════════════════════════════════════ */}
        <section className="bg-[#F8FAFC] py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">03. Envie a cotação</span>
              <h2 className="mt-3 font-display text-[40px] font-bold leading-tight text-[#0F172A]">
                Um clique.{" "}
                <span className="text-[#22C55E]">Distribuidora notificada</span>{" "}
                por WhatsApp e E-mail.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-slate-600 md:text-base">
                Ao confirmar, você escolhe enviar por WhatsApp, por e-mail ou pelos dois ao mesmo tempo. Cada distribuidora recebe os itens, quantidades e prazo na hora.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Envio por WhatsApp e/ou E-mail, você escolhe",
                  "Cada distribuidora recebe a cotação completa",
                  "A negociação acontece diretamente com a distribuidora",
                  "Sem comissão da plataforma por venda",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]"><Check size={11} /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup envio */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
              <div className="border-b border-slate-100 bg-white px-5 py-3">
                <div className="text-xs font-bold uppercase tracking-widest text-[#0F172A]">Enviar cotação</div>
                <div className="mt-0.5 text-[10px] text-slate-500">2 distribuidoras selecionadas · 4 produtos</div>
              </div>

              <div className="p-5 space-y-3">
                {[
                  { initials: "DS", name: "Dist. Silva & Cia",     email: "comercial@silva.com.br",  phone: "(11) 98xxx-xxxx", suggested: true  },
                  { initials: "BN", name: "Bebidas Norte Atacado", email: "pedidos@bebidasnorte.com", phone: "(11) 97xxx-xxxx", suggested: false },
                ].map((d) => (
                  <div key={d.name} className={`rounded-2xl border p-3.5 ${d.suggested ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-[#F8FAFC]"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${d.suggested ? "bg-amber-500" : "bg-slate-600"}`}>
                        {d.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#0F172A]">{d.name}</span>
                          {d.suggested && <span className="text-[9px] font-bold text-amber-600">Sugerida</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
                        <svg className="h-3 w-3 shrink-0 text-[#3B82F6]" viewBox="0 0 16 12" fill="none">
                          <rect x="1" y="1" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M1.5 2L8 7.5 14.5 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[10px] font-medium text-slate-600 truncate">{d.email}</span>
                      </div>
                      <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
                        <svg className="h-3 w-3 shrink-0 text-[#22C55E]" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1a7 7 0 00-6.07 10.47L1 15l3.67-.9A7 7 0 108 1zm0 1.4a5.6 5.6 0 110 11.2 5.6 5.6 0 010-11.2zm-2.1 2.8c-.15 0-.38.06-.58.28-.2.23-.76.75-.76 1.82s.78 2.11.89 2.26c.11.14 1.53 2.34 3.7 3.19.52.2.92.32 1.23.41.52.15.99.13 1.36.08.42-.06 1.28-.52 1.46-1.03.18-.5.18-.93.13-1.02-.05-.09-.19-.14-.4-.24-.2-.1-1.2-.59-1.39-.66-.18-.07-.32-.1-.45.1-.14.2-.52.66-.64.8-.12.14-.24.16-.44.05-.2-.1-.86-.32-1.63-1-.6-.54-1.01-1.2-1.13-1.4-.12-.21-.01-.32.09-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.45-1.09-.62-1.49-.16-.38-.33-.33-.45-.33h-.39z"/>
                        </svg>
                        <span className="text-[10px] font-medium text-slate-600">{d.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#22C55E] py-3 text-sm font-bold text-black">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 00-6.07 10.47L1 15l3.67-.9A7 7 0 108 1zm0 1.4a5.6 5.6 0 110 11.2 5.6 5.6 0 010-11.2zm-2.1 2.8c-.15 0-.38.06-.58.28-.2.23-.76.75-.76 1.82s.78 2.11.89 2.26c.11.14 1.53 2.34 3.7 3.19.52.2.92.32 1.23.41.52.15.99.13 1.36.08.42-.06 1.28-.52 1.46-1.03.18-.5.18-.93.13-1.02-.05-.09-.19-.14-.4-.24-.2-.1-1.2-.59-1.39-.66-.18-.07-.32-.1-.45.1-.14.2-.52.66-.64.8-.12.14-.24.16-.44.05-.2-.1-.86-.32-1.63-1-.6-.54-1.01-1.2-1.13-1.4-.12-.21-.01-.32.09-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.45-1.09-.62-1.49-.16-.38-.33-.33-.45-.33h-.39z"/>
                    </svg>
                    Enviar por WhatsApp e E-mail
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:text-[#0F172A] transition">
                      <svg className="h-3.5 w-3.5 text-[#25D366]" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 00-6.07 10.47L1 15l3.67-.9A7 7 0 108 1zm0 1.4a5.6 5.6 0 110 11.2 5.6 5.6 0 010-11.2zm-2.1 2.8c-.15 0-.38.06-.58.28-.2.23-.76.75-.76 1.82s.78 2.11.89 2.26c.11.14 1.53 2.34 3.7 3.19.52.2.92.32 1.23.41.52.15.99.13 1.36.08.42-.06 1.28-.52 1.46-1.03.18-.5.18-.93.13-1.02-.05-.09-.19-.14-.4-.24-.2-.1-1.2-.59-1.39-.66-.18-.07-.32-.1-.45.1-.14.2-.52.66-.64.8-.12.14-.24.16-.44.05-.2-.1-.86-.32-1.63-1-.6-.54-1.01-1.2-1.13-1.4-.12-.21-.01-.32.09-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.45-1.09-.62-1.49-.16-.38-.33-.33-.45-.33h-.39z"/>
                      </svg>
                      Só WhatsApp
                    </button>
                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:text-[#0F172A] transition">
                      <svg className="h-3.5 w-3.5 text-[#3B82F6]" viewBox="0 0 16 12" fill="none">
                        <rect x="1" y="1" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M1.5 2L8 7.5 14.5 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      Só E-mail
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* ══ NÚMEROS ═══════════════════════════════════════════════════════════ */}

        <section className="border-y border-white/[0.06] bg-[#0B1220] py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-white/40">A plataforma em números</p>
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                { value: 50, suffix: "+", label: "Distribuidoras cadastradas", sub: "e crescendo toda semana" },
                { value: 120, suffix: "",  label: "Municípios atendidos",       sub: "em São Paulo e região" },
                { value: 23, suffix: "%", label: "Economia média por cotação",  sub: "vs. compra por um único fornecedor" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="font-display text-5xl font-bold tracking-tight text-[#22C55E] md:text-6xl lg:text-7xl">
                    <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="mt-2 text-lg font-bold text-white">{stat.label}</div>
                  <div className="mt-1 text-sm text-white/50">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ BENEFÍCIOS ════════════════════════════════════════════════════════ */}
        <section id="beneficios" className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Para quem é a HUBBY</span>
              <h2 className="mt-3 font-display text-[40px] font-bold text-[#0F172A]">Benefícios para cada lado.</h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">

              {/* Compradores */}
              <div className="group rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 transition-all duration-200 hover:border-[#22C55E]/40 md:p-8">
                <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Para compradores
                </div>
                <h3 className="font-display text-[28px] font-bold text-[#0F172A]">Compre melhor sem sair do lugar.</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-slate-600">
                  Bares, restaurantes, adegas, hotéis e mercados que querem economizar no estoque de bebidas sem gastar horas no telefone.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    { title: "Compare várias distribuidoras de uma vez", desc: "Uma cotação, múltiplas respostas. Sem ligar para cada um." },
                    { title: "Veja o menor preço por produto", desc: "O ranking mostra quem tem o melhor preço para cada item." },
                    { title: "Economia real no estoque", desc: "Clientes economizam em média 23% em relação ao fornecedor único." },
                    { title: "Histórico e recompra com 1 clique", desc: "Repita pedidos anteriores sem montar tudo do zero." },
                  ].map((b) => (
                    <li key={b.title} className="flex items-start gap-3">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]"><Check size={11} /></span>
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">{b.title}</p>
                        <p className="text-xs text-slate-500">{b.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
                  <span className="text-sm font-bold text-[#22C55E]">Acesso 100% gratuito</span>
                  <a href="/auth/register" className="rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90">Criar conta</a>
                </div>
              </div>

              {/* Distribuidoras — mantém dark para contraste intencional */}
              <div className="group rounded-2xl border border-white/[0.08] bg-[#0B1220] p-6 transition-all duration-200 hover:border-[#22C55E]/40 md:p-8">
                <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Para distribuidoras
                </div>
                <h3 className="font-display text-[28px] font-bold text-white">Novos clientes todo dia, sem depender de indicação.</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-slate-400">
                  Distribuidoras que querem crescer a carteira de clientes, organizar a equipe comercial e responder cotações com mais agilidade.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    { title: "Apareça nas cotações de quem compra na sua região", desc: "Clientes da sua área já recebem seu preço no ranking automaticamente." },
                    { title: "Receba leads pelo painel e WhatsApp", desc: "Notificação em tempo real para o time comercial não perder nenhuma oportunidade." },
                    { title: "Sem comissão por venda", desc: "A mensalidade é fixa. Cada venda fechada é 100% sua." },
                    { title: "Estoque e preços sempre atualizados", desc: "Integração ERP no plano Avançado sincroniza tudo automaticamente." },
                    { title: "Compradores pré-verificados", desc: "Todo comprador passa por triagem automática: CNPJ ativo, situação cadastral regular e tempo de existência verificados. Você não recebe cotação de empresa irregular." },
                  ].map((b) => (
                    <li key={b.title} className="flex items-start gap-3">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/20 text-[#22C55E]"><Check size={11} /></span>
                      <div>
                        <p className="text-sm font-bold text-white">{b.title}</p>
                        <p className="text-xs text-slate-500">{b.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-5">
                  <span className="text-sm font-bold text-[#22C55E]">Trial 14 dias grátis</span>
                  <a href="/auth/register" className="rounded-lg bg-[#22C55E] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90">Começar trial</a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ APP MOBILE ════════════════════════════════════════════════════════ */}
        <section className="bg-[#F8FAFC] py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_220px] lg:gap-16">

              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#16A34A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                  Disponível para iOS e Android
                </span>
                <h2 className="mt-4 font-display text-[40px] font-bold leading-tight text-[#0F172A]">
                  Prefere cotar pelo celular?{" "}
                  <span className="text-[#22C55E]">Tem app para isso.</span>
                </h2>
                <p className="mt-4 max-w-lg text-[15px] leading-[1.65] text-slate-600 md:text-base">
                  Acesse o ranking de preços, monte pedidos e acompanhe o histórico direto do seu celular. Rápido, sem precisar abrir o computador.
                </p>

                <ul className="mt-5 space-y-2.5">
                  {[
                    "Cote de qualquer lugar: fila do fornecedor, estoque, em trânsito",
                    "Notificações em tempo real quando distribuidora responder",
                    "Recompra com 1 toque a partir do histórico",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]"><Check size={11} /></span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a href="#" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 transition hover:border-slate-300">
                    <svg className="h-6 w-6 text-[#0F172A]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div className="text-left">
                      <p className="text-[10px] font-medium text-slate-400">Baixar na</p>
                      <p className="text-sm font-bold text-[#0F172A]">App Store</p>
                    </div>
                  </a>
                  <a href="#" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 transition hover:border-slate-300">
                    <svg className="h-6 w-6 text-[#0F172A]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.18 23.76c.37.2.8.22 1.2.06l12.11-6.99-2.63-2.63-10.68 9.56zm-1.13-19.9a1.95 1.95 0 00-.05.47v19.34c0 .16.02.32.05.47l10.78-10.14L2.05 3.86zm18.8 8.47l-2.6-1.5L14.7 12l3.43 3.17 2.63-1.52c.75-.43.75-1.57 0-2zM4.38.22C3.98.06 3.55.08 3.18.28L13.93 11.1l2.63-2.63L4.38.22z"/>
                    </svg>
                    <div className="text-left">
                      <p className="text-[10px] font-medium text-slate-400">Disponível no</p>
                      <p className="text-sm font-bold text-[#0F172A]">Google Play</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Mini mockup celular */}
              <div className="hidden lg:block">
                <div className="relative mx-auto w-[200px]">
                  <div className="overflow-hidden rounded-[2.5rem] border-[6px] border-[#1a2332] bg-[#1a2332]" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
                    <div className="flex justify-center pt-2 pb-1">
                      <div className="h-1.5 w-14 rounded-full bg-[#0D1117]" />
                    </div>
                    <div className="bg-[#0D1117] px-3 pb-4 pt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[8px] font-bold text-slate-600">9:41</span>
                        <div className="flex gap-1">
                          <div className="h-1.5 w-3 rounded-sm bg-slate-700" />
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                        </div>
                      </div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="logo-hubby text-[9px] text-white">HUBBY</span>
                        <span className="rounded-full bg-[#22C55E]/15 px-1.5 py-0.5 text-[7px] font-bold text-[#22C55E]">3 novas</span>
                      </div>
                      {[
                        { name: "Heineken LN 330ml", price: "R$ 4,00/un",  dist: "Beta Drinks", color: "bg-[#22C55E]" },
                        { name: "Jack Daniel's 1L",  price: "R$ 69,90/un", dist: "Beta Drinks", color: "bg-[#2563EB]" },
                        { name: "Absolut 1L",        price: "R$ 52,00/un", dist: "Alpha Beb.",  color: "bg-[#8B5CF6]" },
                      ].map((item) => (
                        <div key={item.name} className="mb-1.5 flex items-center gap-1.5 rounded-xl bg-[#1a2332] px-2 py-1.5">
                          <div className={`h-5 w-1 shrink-0 rounded-full ${item.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-[8px] font-bold text-white">{item.name}</p>
                            <p className="text-[7px] text-slate-500">{item.dist}</p>
                          </div>
                          <span className="font-mono text-[8px] font-medium text-[#22C55E]">{item.price}</span>
                        </div>
                      ))}
                      <div className="mt-2 rounded-xl bg-[#22C55E] py-1.5 text-center text-[9px] font-bold text-black">
                        Confirmar cotação →
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-3 left-1/2 h-6 w-32 -translate-x-1/2 rounded-full bg-[#22C55E]/10 blur-xl" />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ DEPOIMENTOS ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#0B1220] py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Depoimentos</span>
              <h2 className="mt-3 font-display text-[40px] font-bold text-white">Quem já usa, não volta atrás.</h2>
            </div>

            <div className="mt-10">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 md:p-10">
                <div className="mb-5 flex gap-1">
                  {Array.from({ length: testimonials[activeTestimonial].stars }).map((_, i) => (
                    <Star key={i} size={18} className="fill-[#22C55E] text-[#22C55E]" />
                  ))}
                </div>
                <blockquote className="text-xl font-medium leading-[1.65] text-white md:text-2xl">
                  &ldquo;{testimonials[activeTestimonial].text}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-base font-bold text-[#22C55E]">
                    {testimonials[activeTestimonial].name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{testimonials[activeTestimonial].name}</div>
                    <div className="text-sm text-white/70">
                      {testimonials[activeTestimonial].role} · {testimonials[activeTestimonial].company}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-center gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${i === activeTestimonial ? "w-8 bg-[#22C55E]" : "w-2 bg-white/20"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ PLANOS ════════════════════════════════════════════════════════════ */}
        <section id="planos" className="bg-[#0D1117] py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">

            <div className="mb-10 text-center">
              <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
                Planos e preços
              </span>
              <h2 className="mt-4 font-display text-[40px] font-bold text-white">
                Para distribuidoras que querem crescer.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-slate-400">
                Compradores entram grátis. Distribuidoras pagam por performance e visibilidade.
              </p>
            </div>

            {/* Toggle de período */}
            <div className="mb-8 flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center rounded-xl border border-white/10 bg-[#1f2937] p-1 gap-1">
                {(["monthly", "quarterly", "semiannual", "annual"] as PeriodKey[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={[
                      "relative min-h-[44px] cursor-pointer select-none rounded-lg px-4 py-2.5 text-[13px] font-semibold touch-manipulation transition-all duration-200",
                      period === p ? "bg-[#22C55E] text-black shadow-sm" : "text-slate-400 hover:text-white",
                    ].join(" ")}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              {period === "annual" && (
                <span className="rounded-full bg-[#22C55E] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-black">
                  ECONOMIZE 20%
                </span>
              )}
            </div>

            {/* Cards distribuidoras */}
            <div>
              <div className="mb-6 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">Para</p>
                  <h3 className="font-display text-[28px] font-bold text-white">Distribuidoras</h3>
                </div>
                <p className="text-right text-[11px] text-slate-500">
                  {period === "monthly" ? "14 dias grátis · " : ""}cancele quando quiser · sem comissão
                </p>
              </div>

              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
                {(["starter", "pro", "business"] as const).map((planKey) => {
                  const isPro = planKey === "pro";
                  const names = { starter: "Starter", pro: "Pro", business: "Business" };
                  const descs = {
                    starter: "Presença garantida onde os compradores estão.",
                    pro: "Para equipes que querem vender mais e perder menos.",
                    business: "Para distribuidoras que querem escalar com controle total.",
                  };
                  const features: Record<string, string[]> = {
                    starter: ["Perfil e portfólio na plataforma", "Cotações via painel e WhatsApp", "Painel com métricas básicas", "1 contato comercial"],
                    pro: ["Tudo do Starter", "Mais usuários com permissões", "Destaque comercial no ranking", "Prioridade em empate técnico", "Histórico completo de cotações", "Selo de distribuidora verificada"],
                    business: ["Tudo do Pro", "Usuários ilimitados", "Hierarquia de equipes", "Integração ERP via webhook", "Relatórios avançados", "Onboarding e suporte dedicados"],
                  };
                  const monthly = DIST_MONTHLY[planKey][period];
                  const total   = DIST_TOTAL[planKey][period];
                  const months  = PERIOD_MONTHS[period];

                  return (
                    <div
                      key={planKey}
                      className={[
                        "relative flex flex-col rounded-2xl px-6 py-6",
                        isPro
                          ? "border-2 border-[#22C55E] bg-[#111827]"
                          : "border border-white/10 bg-[#111827]",
                      ].join(" ")}
                      style={isPro ? { boxShadow: "0 0 40px rgba(34,197,94,0.15)" } : undefined}
                    >
                      {isPro && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22C55E] px-4 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
                          Mais popular
                        </div>
                      )}

                      <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isPro ? "text-[#22C55E]" : "text-slate-500"}`}>
                        HUBBY {names[planKey]}
                      </p>

                      <div className="mt-3 leading-none">
                        <div className="flex items-end gap-1">
                          <span className="font-display text-[2rem] font-bold text-white">{formatBRL(monthly)}</span>
                          <span className="mb-0.5 text-xs text-slate-500">/mês</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {period === "monthly"
                            ? "cobrança mês a mês"
                            : `${formatBRL(total)} cobrados ${months === 3 ? "a cada 3 meses" : months === 6 ? "a cada 6 meses" : "anualmente"}`}
                        </p>
                      </div>

                      <p className="mt-3 text-[13px] leading-[1.65] text-slate-400">{descs[planKey]}</p>

                      <div className="my-5 h-px bg-white/[0.06]" />

                      <ul className="space-y-2.5 text-[13px] text-slate-400">
                        {features[planKey].map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <Check size={12} className={`mt-px shrink-0 ${isPro ? "text-[#22C55E]" : "text-slate-500"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto border-t border-white/[0.06] pt-6">
                        <a
                          href={`/auth/register?plan=${planKey}&period=${period}`}
                          className={[
                            "flex w-full items-center justify-center rounded-lg py-3 text-[13px] font-bold transition",
                            isPro ? "bg-[#22C55E] text-black hover:opacity-90" : "border border-white/15 text-slate-400 hover:border-white/30 hover:text-white",
                          ].join(" ")}
                        >
                          {period === "monthly" ? "Começar teste grátis" : "Começar agora"}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Enterprise */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#111827] px-6 py-5">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">HUBBY Enterprise</p>
                    <p className="mt-1 text-sm font-bold text-white">Sob consulta — para operações de grande escala</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">Usuários ilimitados · SLA garantido · integração sob medida</p>
                  </div>
                  <a
                    href="mailto:comercial@hubby.com.br"
                    className="shrink-0 rounded-lg border border-white/20 px-5 py-2.5 text-[13px] font-bold text-slate-400 transition hover:border-white/40 hover:text-white"
                  >
                    Falar com vendas →
                  </a>
                </div>
                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-600">Exclusivo Enterprise</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-slate-500">
                    {[
                      "Gestão automática de vencimentos — integra com ERP e cria promoções automaticamente antes do estoque vencer. Nunca mais perca dinheiro com produto vencido.",
                      "Webhook ERP para sincronização de lotes e datas de vencimento em tempo real",
                      "Notificação automática a compradores da região quando produto entra em modo urgente",
                    ].map((f) => (
                      <span key={f} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 text-[#22C55E]">✓</span>{f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-5 text-center text-[11px] text-slate-600">
                Ranking calculado por preço, prazo e disponibilidade. Planos superiores ganham destaque comercial em empates técnicos.
              </p>
            </div>

            {/* Compradores */}
            <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#111827] p-6">
              <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">Para</p>
                  <h3 className="font-display text-lg font-bold text-white">Compradores</h3>
                </div>
                <p className="text-[11px] text-slate-500">Acesso gratuito para sempre · upgrade quando precisar</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#1a2332] p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white">Grátis</span>
                      <span className="text-[11px] text-slate-500">para sempre · sem cartão</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                      {["Distribuidoras da região", "Cotações ilimitadas", "Histórico básico"].map((f) => (
                        <span key={f} className="text-[11px] text-slate-500">{f}</span>
                      ))}
                    </div>
                  </div>
                  <a href="/auth/register" className="shrink-0 rounded-lg border border-white/20 bg-white/[0.05] px-4 py-2 text-[12px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white">
                    Criar conta grátis
                  </a>
                </div>

                <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/[0.05] p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-bold text-white">HUBBY Pro</span>
                      <span className="font-mono text-sm font-medium text-[#22C55E]">{formatBRL(BUYER_MONTHLY[period])}/mês</span>
                      {period !== "monthly" && (
                        <span className="text-[10px] text-slate-500">
                          ({formatBRL(BUYER_TOTAL[period])} {PERIOD_MONTHS[period] === 3 ? "tri" : PERIOD_MONTHS[period] === 6 ? "sem" : "ano"})
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                      {["Múltiplas regiões de SP", "Até 10 usuários", "Histórico ilimitado", "Alertas de preço"].map((f) => (
                        <span key={f} className="text-[11px] text-slate-500">{f}</span>
                      ))}
                    </div>
                  </div>
                  <a href={`/checkout/comprador?period=${period}`} className="shrink-0 rounded-lg bg-[#22C55E] px-4 py-2 text-[12px] font-bold text-black transition hover:opacity-90">
                    Assinar Pro
                  </a>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ══ INDICAÇÃO ════════════════════════════════════════════════════════ */}
        <section id="indicacao" className="bg-[#0B1220] py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">

            <div className="mb-12 text-center">
              <span className="inline-block rounded-full border border-[#22C55E]/30 bg-[#22C55E]/[0.07] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#22C55E]">
                Programa de indicação
              </span>
              <h2 className="mt-4 font-display text-[36px] font-bold leading-tight text-white">
                Indique uma distribuidora.<br />Ganhe meses grátis.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.65] text-slate-400">
                Conhece uma distribuidora que deveria estar na Hubby? Indique e ganhe até 90 dias do plano Pro gratuitamente.
              </p>
            </div>

            {/* Cards escalonados */}
            <div className="mb-12 grid gap-4 sm:grid-cols-3">
              {[
                { n: "1",   days: "30 dias",  desc: "1ª conversão",      highlight: false, extra: null },
                { n: "2",   days: "60 dias",  desc: "2ª conversão",      highlight: true,  extra: null },
                { n: "3+",  days: "90 dias",  desc: "3ª+ conversão",     highlight: false, extra: "Badge Embaixador Hubby" },
              ].map((card) => (
                <div
                  key={card.n}
                  className={[
                    "relative rounded-2xl border p-6 text-center",
                    card.highlight
                      ? "border-[#22C55E]/40 bg-[#22C55E]/[0.06]"
                      : "border-white/[0.08] bg-[#111827]",
                  ].join(" ")}
                >
                  {card.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22C55E] px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
                      Mais popular
                    </div>
                  )}
                  <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${card.highlight ? "bg-[#22C55E] text-black" : "bg-white/[0.08] text-slate-400"}`}>
                    {card.n}
                  </div>
                  <p className={`text-2xl font-black ${card.highlight ? "text-[#22C55E]" : "text-white"}`}>{card.days}</p>
                  <p className="mt-1 text-xs text-slate-500">Pro grátis · {card.desc}</p>
                  {card.extra && (
                    <p className="mt-2 text-[11px] font-bold text-[#22C55E]">+ {card.extra}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Como funciona */}
            <div className="mb-12 grid gap-4 sm:grid-cols-3 text-center">
              {[
                { step: "1", title: "Crie sua conta", desc: "Cadastre-se como comprador — grátis para sempre." },
                { step: "2", title: "Copie seu link", desc: "Cada conta tem um link único de indicação no perfil." },
                { step: "3", title: "Ganhe dias Pro", desc: "Quando a distribuidora assinar, você recebe a recompensa automaticamente." },
              ].map((s) => (
                <div key={s.step} className="rounded-2xl border border-white/[0.06] bg-[#111827] p-5">
                  <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-black text-slate-400">{s.step}</div>
                  <p className="text-sm font-bold text-white">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center">
              <a
                href="/auth/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#22C55E] px-8 py-3.5 text-sm font-bold text-black transition hover:opacity-90"
              >
                Criar minha conta e começar a indicar →
              </a>
              <p className="mt-3 text-xs text-slate-500">
                Já tem conta?{" "}
                <a href="/auth/login" className="text-[#22C55E] hover:underline">Entrar e ver meu código →</a>
              </p>
            </div>

          </div>
        </section>

        {/* ══ FAQ ═══════════════════════════════════════════════════════════════ */}
        <FaqSection />

        <SiteFooter />

        {/* ══ WHATSAPP FLUTUANTE ════════════════════════════════════════════════ */}
        <a
          href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20a%20HUBBY"
          target="_blank"
          rel="noopener noreferrer"
          title="Falar no WhatsApp"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-500/30 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/40"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </a>

      </div>
    </div>
  );
}
