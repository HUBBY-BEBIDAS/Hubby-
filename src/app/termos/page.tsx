import Link from "next/link";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-display font-bold text-[#0F172A]">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function TermosPage() {
  return (
    <>
      <SiteNavbar />
      <div className="min-h-screen bg-[#F5F7FB]">
        <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
          <div className="mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Legal</span>
            <h1 className="mt-4 text-4xl font-display font-extrabold text-[#0F172A]">Termos de Uso</h1>
            <p className="mt-2 text-sm text-slate-400">Última atualização: abril de 2026</p>
          </div>

          <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm lg:p-12">

            <Section title="1. O que é a Hubby e como funciona">
              <p>A Hubby é uma plataforma B2B de cotação de bebidas que conecta compradores (bares, restaurantes, adegas e similares) com distribuidoras de bebidas registradas no Brasil.</p>
              <p>O funcionamento é simples: o comprador cria uma cotação com os produtos desejados; a plataforma exibe automaticamente o ranking de preços das distribuidoras que atendem a região do comprador; o comprador seleciona e envia a cotação para a(s) distribuidora(s) escolhida(s).</p>
              <p>A Hubby é um canal de intermediação digital. <strong>A negociação, o pagamento e a emissão de nota fiscal ocorrem diretamente entre comprador e distribuidora</strong>, sem qualquer participação da Hubby.</p>
            </Section>

            <Section title="2. Responsabilidades do comprador">
              <p>Ao criar uma conta como comprador, você declara que:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Possui CNPJ ativo e regularizado na Receita Federal;</li>
                <li>As informações fornecidas no cadastro são verdadeiras e atualizadas;</li>
                <li>Tem poderes para representar a empresa cadastrada;</li>
                <li>Usará a plataforma somente para fins comerciais legítimos.</li>
              </ul>
              <p>O comprador é responsável por honrar os pedidos enviados e pela veracidade dos dados cadastrais.</p>
            </Section>

            <Section title="3. Responsabilidades da distribuidora">
              <p>Distribuidoras cadastradas na plataforma comprometem-se a:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Manter preços, disponibilidade e condições de entrega atualizados;</li>
                <li>Responder às cotações dentro de um prazo razoável;</li>
                <li>Cumprir os pedidos aceitos conforme as condições acordadas;</li>
                <li>Emitir a nota fiscal correspondente diretamente ao comprador;</li>
                <li>Manter CNPJ ativo e dentro das regulamentações da ANVISA e legislação vigente.</li>
              </ul>
            </Section>

            <Section title="4. A Hubby não intermedia pagamentos nem emite notas fiscais">
              <p>A Hubby <strong>não processa pagamentos</strong> entre comprador e distribuidora. Toda transação financeira é realizada diretamente entre as partes.</p>
              <p>A Hubby <strong>não emite notas fiscais</strong>. A nota fiscal de cada venda é responsabilidade exclusiva da distribuidora vendedora.</p>
              <p>A Hubby não se responsabiliza por inadimplência, atrasos de entrega, divergências de preço após a confirmação do pedido, ou qualquer disputa comercial entre comprador e distribuidora.</p>
            </Section>

            <Section title="5. Planos e cobrança">
              <p>O acesso à plataforma para compradores é gratuito no plano básico. Planos pagos são cobrados mensalmente ou conforme o período contratado.</p>
              <p>Para distribuidoras, é oferecido um período de teste gratuito de 14 dias. Após esse período, a cobrança ocorre conforme o plano escolhido. O pagamento é processado por plataformas seguras de terceiros (Stripe ou similar).</p>
              <p>A Hubby reserva-se o direito de ajustar os preços dos planos com aviso prévio de 30 dias.</p>
            </Section>

            <Section title="6. Cancelamento de conta e planos">
              <p>Qualquer usuário pode solicitar o cancelamento da conta a qualquer momento acessando o perfil ou entrando em contato pelo e-mail <a href="mailto:suporte@hubby.com.br" className="text-[#2563EB] hover:underline">suporte@hubby.com.br</a>.</p>
              <p>Para planos pagos de distribuidoras: o cancelamento encerra a renovação automática; o acesso permanece até o fim do período já pago.</p>
              <p>Após o cancelamento, os dados do usuário são removidos conforme nossa Política de Privacidade.</p>
            </Section>

            <Section title="7. Propriedade intelectual">
              <p>Todo o conteúdo da plataforma — incluindo código, design, textos e marca — é propriedade da Hubby ou de seus licenciadores. É vedada a reprodução, cópia ou uso comercial sem autorização prévia e por escrito.</p>
            </Section>

            <Section title="8. Limitação de responsabilidade">
              <p>A Hubby atua como plataforma de conexão e não se responsabiliza por:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Qualidade, quantidade ou regularidade fiscal dos produtos negociados;</li>
                <li>Inadimplência ou descumprimento de contratos entre comprador e distribuidora;</li>
                <li>Prejuízos decorrentes de indisponibilidade temporária da plataforma;</li>
                <li>Informações incorretas fornecidas por usuários.</li>
              </ul>
              <p>Em nenhuma hipótese a responsabilidade da Hubby excederá o valor pago pelo usuário nos últimos 3 meses de uso da plataforma.</p>
            </Section>

            <Section title="9. Alterações dos termos">
              <p>Estes Termos podem ser atualizados periodicamente. Usuários serão notificados por e-mail com 15 dias de antecedência em caso de alterações materiais. O uso continuado da plataforma após a data de vigência das alterações implica aceitação dos novos termos.</p>
            </Section>

            <Section title="10. Foro e legislação aplicável">
              <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de São Paulo/SP para resolução de eventuais controvérsias, salvo disposição legal em contrário.</p>
            </Section>

            <div className="mt-8 border-t border-[#DBEAFE] pt-6 text-xs text-slate-400">
              Dúvidas? <a href="mailto:suporte@hubby.com.br" className="text-[#2563EB] hover:underline">suporte@hubby.com.br</a>
              {" · "}
              <Link href="/privacidade" className="text-[#2563EB] hover:underline">Política de Privacidade</Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
