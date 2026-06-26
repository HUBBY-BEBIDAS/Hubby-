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

export default function PrivacidadePage() {
  return (
    <>
      <SiteNavbar />
      <div className="min-h-screen bg-[#F5F7FB]">
        <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
          <div className="mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#22C55E]">Legal</span>
            <h1 className="mt-4 text-4xl font-display font-extrabold text-[#0F172A]">Política de Privacidade</h1>
            <p className="mt-2 text-sm text-slate-400">Última atualização: abril de 2026 · em conformidade com a LGPD (Lei 13.709/2018)</p>
          </div>

          <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm lg:p-12">

            <Section title="1. Quem somos">
              <p>A Hubby (controladora dos dados) é uma plataforma B2B de cotação de bebidas operada no Brasil, com sede em São Paulo/SP. Para dúvidas sobre privacidade, entre em contato com nosso DPO pelo e-mail <a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] hover:underline">privacidade@hubby.com.br</a>.</p>
            </Section>

            <Section title="2. Quais dados coletamos">
              <p><strong>Dados de cadastro:</strong> CNPJ, razão social, nome do responsável, e-mail, telefone/WhatsApp, endereço de entrega (para compradores) e dados comerciais (para distribuidoras).</p>
              <p><strong>Dados de uso:</strong> cotações realizadas, pedidos enviados, produtos mais consultados, histórico de compras.</p>
              <p><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, logs de acesso (retidos por 6 meses), cookies de sessão.</p>
              <p><strong>Dados financeiros:</strong> informações de pagamento são processadas diretamente por Stripe ou plataformas equivalentes. A Hubby não armazena dados de cartão de crédito.</p>
            </Section>

            <Section title="3. Como usamos os dados">
              <ul className="ml-4 list-disc space-y-1">
                <li>Autenticação e segurança de contas;</li>
                <li>Cálculo do ranking de cotações e matching entre compradores e distribuidoras;</li>
                <li>Consulta de crédito via bureau (Serasa Experian ou similar) para análise de credencial;</li>
                <li>Envio de notificações transacionais (WhatsApp, e-mail) sobre cotações e pedidos;</li>
                <li>Geração de relatórios mensais de uso para o comprador;</li>
                <li>Prevenção de fraude e cumprimento de obrigações legais;</li>
                <li>Melhoria contínua da plataforma (dados anonimizados).</li>
              </ul>
              <p>Não usamos seus dados para publicidade de terceiros.</p>
            </Section>

            <Section title="4. Compartilhamento com terceiros">
              <p>Compartilhamos dados apenas com parceiros necessários para a operação da plataforma:</p>
              <table className="w-full text-xs border border-[#DBEAFE] rounded-xl overflow-hidden">
                <thead className="bg-[#F5F7FB]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Parceiro</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Finalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBEAFE]">
                  {[
                    ["Serasa Experian / Boa Vista", "Análise de crédito de compradores"],
                    ["SendGrid / Amazon SES", "Envio de e-mails transacionais"],
                    ["Z-API / Twilio", "Envio de notificações via WhatsApp"],
                    ["Stripe / Iugu", "Processamento de pagamentos de distribuidoras"],
                    ["Cloudflare", "Proteção da infraestrutura (WAF/CDN)"],
                    ["Sentry", "Monitoramento de erros (dados técnicos anonimizados)"],
                  ].map(([p, f]) => (
                    <tr key={p}>
                      <td className="px-3 py-2 font-medium text-[#0F172A]">{p}</td>
                      <td className="px-3 py-2 text-slate-500">{f}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Nunca vendemos dados pessoais a terceiros.</p>
            </Section>

            <Section title="5. Direitos do usuário (LGPD)">
              <p>Conforme a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li><strong>Acesso:</strong> solicitar uma cópia dos seus dados pessoais;</li>
                <li><strong>Correção:</strong> atualizar dados incorretos ou desatualizados;</li>
                <li><strong>Exclusão:</strong> solicitar a remoção dos dados (atendida em até 30 dias);</li>
                <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado;</li>
                <li><strong>Revogação de consentimento:</strong> cancelar autorizações concedidas.</li>
              </ul>
              <p>Para exercer seus direitos, envie um e-mail para <a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] hover:underline">privacidade@hubby.com.br</a> com o assunto "Direitos LGPD".</p>
            </Section>

            <Section title="6. Retenção de dados">
              <ul className="ml-4 list-disc space-y-1">
                <li><strong>Logs de acesso:</strong> 6 meses (conforme Marco Civil da Internet);</li>
                <li><strong>Dados cadastrais e histórico:</strong> enquanto a conta estiver ativa; removidos em até 30 dias após solicitação de exclusão;</li>
                <li><strong>Dados financeiros (para compliance):</strong> até 5 anos, conforme legislação tributária.</li>
              </ul>
            </Section>

            <Section title="7. Segurança dos dados">
              <p>Adotamos medidas técnicas e organizacionais para proteger seus dados:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256);</li>
                <li>Acesso ao banco de dados restrito a sistemas internos via VPC;</li>
                <li>Autenticação de dois fatores para contas de distribuidoras;</li>
                <li>Auditoria de acessos e monitoramento contínuo.</li>
              </ul>
              <p>Em caso de incidente de segurança que possa afetar titulares, notificaremos a ANPD e os usuários afetados em até 72 horas, conforme exigido pela LGPD.</p>
            </Section>

            <Section title="8. Cookies">
              <p>Utilizamos cookies estritamente necessários para autenticação e segurança. Não utilizamos cookies de rastreamento para publicidade.</p>
            </Section>

            <Section title="9. Contato do DPO">
              <p>Encarregado de Proteção de Dados (DPO):<br />
              E-mail: <a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] hover:underline">privacidade@hubby.com.br</a><br />
              Prazo de resposta: até 15 dias úteis.</p>
            </Section>

            <Section title="10. Alterações desta política">
              <p>Esta Política pode ser atualizada para refletir mudanças operacionais ou legais. Notificaremos usuários por e-mail em caso de alterações materiais.</p>
            </Section>

            <div className="mt-8 border-t border-[#DBEAFE] pt-6 text-xs text-slate-400">
              <Link href="/termos" className="text-[#2563EB] hover:underline">Termos de Uso</Link>
              {" · "}
              <Link href="/suporte" className="text-[#2563EB] hover:underline">Central de Suporte</Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
