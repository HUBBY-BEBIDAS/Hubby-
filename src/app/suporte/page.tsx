import Link from "next/link";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";

const FAQ = [
  {
    q: "Como faço para enviar uma cotação?",
    a: "Acesse 'Nova Cotação', adicione os produtos desejados e clique em Enviar. A plataforma notifica automaticamente as distribuidoras da sua região.",
  },
  {
    q: "A Hubby cobra comissão por venda?",
    a: "Nunca. Compradores usam a plataforma gratuitamente. Distribuidoras pagam apenas a mensalidade do plano — sem comissão por venda.",
  },
  {
    q: "Como a distribuidora recebe meu pedido?",
    a: "Por WhatsApp e/ou e-mail em tempo real, e também pelo painel da plataforma. Você escolhe o canal ao confirmar a cotação.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Usamos criptografia AES-256, HTTPS em tudo, e seguimos rigorosamente a LGPD. Consulte nossa Política de Privacidade para detalhes.",
  },
  {
    q: "Como cancelo minha conta?",
    a: "Acesse seu perfil e solicite a exclusão da conta. Dados são removidos em até 30 dias conforme a LGPD. Para distribuidoras, o plano é cancelado no fim do período vigente.",
  },
];

export default function SuportePage() {
  const now = new Date();
  const hourBRT = (now.getUTCHours() - 3 + 24) % 24;
  const dayBRT  = (now.getUTCDay() + (now.getUTCHours() < 3 ? -1 + 7 : 0)) % 7;
  const isOpen  = dayBRT >= 1 && dayBRT <= 5 && hourBRT >= 8 && hourBRT < 18;

  return (
    <>
      <SiteNavbar />
      <div className="min-h-screen bg-[#F5F7FB]">
        <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">

          {/* Header */}
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Central de Ajuda</span>
            <h1 className="mt-4 text-4xl font-display font-extrabold text-[#0F172A]">Como podemos ajudar?</h1>
            <p className="mt-4 text-base text-slate-500">
              Estamos aqui para resolver qualquer dúvida sobre a plataforma.
            </p>
          </div>

          {/* Status do sistema */}
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
            <span className="h-3 w-3 shrink-0 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-green-800">Todos os serviços operando normalmente</p>
              <p className="text-xs text-green-600">Última verificação: agora</p>
            </div>
          </div>

          {/* Canais de contato */}
          <div className="mb-10 grid gap-4 sm:grid-cols-2">
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20na%20Hubby"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 rounded-2xl border border-[#DBEAFE] bg-white p-6 shadow-sm transition hover:border-[#22C55E] hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[#0F172A]">WhatsApp</p>
                <p className="mt-0.5 text-sm text-slate-500">Resposta em até 2 horas</p>
                <p className="mt-1 text-sm font-semibold text-[#25D366]">Falar com suporte →</p>
              </div>
            </a>

            <a
              href="mailto:suporte@hubby.com.br"
              className="flex items-start gap-4 rounded-2xl border border-[#DBEAFE] bg-white p-6 shadow-sm transition hover:border-[#2563EB] hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[#0F172A]">E-mail</p>
                <p className="mt-0.5 text-sm text-slate-500">suporte@hubby.com.br</p>
                <p className="mt-1 text-sm font-semibold text-[#2563EB]">Enviar e-mail →</p>
              </div>
            </a>
          </div>

          {/* Horário */}
          <div className="mb-10 rounded-2xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-display font-bold text-[#0F172A]">Horário de atendimento</h2>
                <p className="mt-1 text-sm text-slate-500">Segunda a sexta, das 8h às 18h (horário de Brasília)</p>
              </div>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isOpen ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-green-500" : "bg-slate-400"}`} />
                {isOpen ? "Aberto agora" : "Fora do horário"}
              </span>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="mb-6 text-xl font-display font-bold text-[#0F172A]">Perguntas frequentes</h2>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <details key={i} className="group rounded-2xl border border-[#DBEAFE] bg-white shadow-sm">
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#0F172A] marker:content-none">
                    {item.q}
                    <span className="shrink-0 text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="mt-10 text-center text-sm text-slate-400">
            Ainda com dúvidas?{" "}
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#25D366]">
              Fale pelo WhatsApp
            </a>{" "}
            ou acesse{" "}
            <Link href="/privacidade" className="font-semibold text-[#2563EB]">nossa Política de Privacidade</Link>.
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
