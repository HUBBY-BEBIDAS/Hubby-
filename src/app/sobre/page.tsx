import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import { Eye, Zap, Users } from "lucide-react";

export const metadata = {
  title: "Sobre nós | Hubby",
  description:
    "A Hubby nasceu para ser a infraestrutura de distribuição de bebidas do Brasil.",
};

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteNavbar />

      {/* Espaçamento para a navbar fixa */}
      <div className="h-20" />

      {/* Hero */}
      <section className="border-b border-[#DBEAFE] bg-[#F5F7FB] py-14">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB]">
            Sobre nós
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight leading-tight text-[#0F172A] md:text-5xl lg:text-6xl">
            Por que a Hubby existe
          </h1>
          <p className="mt-6 text-lg font-medium leading-relaxed text-slate-500">
            A tecnologia que conecta quem precisa comprar com quem tem para vender.
          </p>
        </div>
      </section>

      {/* Conteúdo principal */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-start">

            {/* Texto */}
            <div className="space-y-7 text-[17px] leading-[1.85] text-slate-600">
              <p className="font-medium">
                A <strong className="text-[#0F172A]">HUBBY</strong> nasceu de uma observação
                simples: comprar bebidas para um bar, restaurante ou adega ainda é um processo
                manual, fragmentado e pouco eficiente.
              </p>
              <p className="font-medium">
                Cada comprador ligava para uma distribuidora, mandava mensagem no WhatsApp para
                outra, anotava o preço numa planilha e torcia para não esquecer nenhum
                fornecedor. Do outro lado, as distribuidoras perdiam vendas por demora no
                atendimento e gastavam horas da equipe respondendo cotações repetitivas.
              </p>
              <p className="font-medium">
                Vimos nesse problema uma oportunidade:{" "}
                <strong className="text-[#0F172A]">
                  criar a infraestrutura que esse mercado nunca teve.
                </strong>
              </p>
              <p className="font-medium">
                A HUBBY foi construída para ser a camada de inteligência comercial entre
                compradores e distribuidoras, organizando o fluxo de cotação, trazendo
                visibilidade real para a decisão de compra e tornando cada transação mais
                rápida, mais transparente e mais confiável.
              </p>
              <p className="font-medium">
                Não somos um marketplace. Não cobramos comissão. Não interferimos na
                negociação ou no pagamento.
              </p>
              <p className="font-medium">
                Somos a ponte. A tecnologia que conecta quem precisa comprar com quem tem
                para vender, de forma inteligente, escalável e justa para os dois lados.
              </p>
              <p className="font-medium">
                Nosso objetivo de longo prazo é ser a infraestrutura de distribuição de
                bebidas do Brasil. Começamos por São Paulo, expandimos para o país inteiro
                e, no futuro, seremos a plataforma que qualquer distribuidora usa para gerir
                seus canais de venda e qualquer comprador usa para tomar decisões de compra
                com dados reais.
              </p>
              <p className="font-semibold text-[#0F172A]">
                Estamos no início. E é exatamente por isso que cada distribuidora e cada
                comprador que entra agora faz parte da construção de algo maior.
              </p>
            </div>

            {/* Card escuro */}
            <div className="lg:sticky lg:top-28">
              <div className="rounded-[2rem] bg-[#0B1220] px-10 py-14 text-white shadow-2xl">
                <div className="mb-8 h-0.5 w-12 bg-[#2563EB]" />
                <blockquote className="text-2xl font-extrabold tracking-tight leading-snug md:text-3xl">
                  &ldquo;Não somos um marketplace.{" "}
                  <span className="text-[#2563EB]">Somos a infraestrutura</span>{" "}
                  que o mercado de bebidas nunca teve.&rdquo;
                </blockquote>
                <div className="mt-6 h-px w-full bg-white/10" />
                <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-slate-400">
                  HUBBY · São Paulo, 2026
                </p>
              </div>
            </div>
          </div>

          {/* 3 pilares */}
          <div className="mt-16 grid gap-5 grid-cols-1 sm:grid-cols-3">
            {[
              {
                icon: <Eye size={36} />,
                title: "Transparência",
                desc: "Preços visíveis e decisões informadas para todos os lados.",
              },
              {
                icon: <Zap size={36} />,
                title: "Eficiência",
                desc: "Uma única cotação alcança todas as distribuidoras de uma vez.",
              },
              {
                icon: <Users size={36} />,
                title: "Confiança",
                desc: "Análise de crédito e histórico de pagamentos integrados à plataforma.",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-3xl border border-[#DBEAFE] bg-[#F5F7FB] px-8 py-9"
              >
                <span className="text-[#22C55E]">{p.icon}</span>
                <h3 className="mt-5 text-xl font-extrabold tracking-tight text-[#0F172A]">{p.title}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0B1220] py-14 text-white">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Faça parte da construção.
          </h2>
          <p className="mt-5 text-base font-medium leading-relaxed text-slate-400">
            Distribuidoras e compradores que entram agora ajudam a moldar o produto.
            Cada feedback vira funcionalidade.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/auth/register?role=distributor"
              className="w-full rounded-2xl bg-[#2563EB] px-8 py-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8] sm:w-auto"
            >
              Sou distribuidora
            </a>
            <a
              href="/auth/register?role=client"
              className="w-full rounded-2xl border border-white/20 px-8 py-4 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Sou comprador
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
