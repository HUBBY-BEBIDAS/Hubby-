import Link from "next/link";

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-3 pt-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]/10 font-mono text-sm font-bold text-[#2563EB]">
        {number}
      </span>
      <h2 className="text-xl font-display font-extrabold text-[#0F172A]">{title}</h2>
    </div>
  );
}

export default function PrivacidadePage() {
  const sections = [
    { id: "s1", title: "1. Quem somos e como nos contatar" },
    { id: "s2", title: "2. Definições importantes" },
    { id: "s3", title: "3. Quais dados coletamos e por que" },
    { id: "s4", title: "4. Base legal para o tratamento dos dados" },
    { id: "s5", title: "5. Como usamos os dados coletados" },
    { id: "s6", title: "6. Compartilhamento de dados com terceiros" },
    { id: "s7", title: "7. Transferência internacional de dados" },
    { id: "s8", title: "8. Por quanto tempo guardamos os dados" },
    { id: "s9", title: "9. Seus direitos como titular dos dados" },
    { id: "s10", title: "10. Cookies e tecnologias de rastreamento" },
    { id: "s11", title: "11. Segurança dos dados" },
    { id: "s12", title: "12. Dados de menores de idade" },
    { id: "s13", title: "13. Score de crédito e análise de risco" },
    { id: "s14", title: "14. Notificações e comunicações de marketing" },
    { id: "s15", title: "15. Alterações nesta Política de Privacidade" },
    { id: "s16", title: "16. Como exercer seus direitos" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
        {/* Banner Header */}
        <div className="bg-[#0F172A] py-14 text-white">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#22C55E]/10 px-3 py-1 text-xs font-semibold text-[#22C55E]">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]"></span>
                LGPD (Lei 13.709/2018)
              </div>
              <Link
                href="/painel"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800/90 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 hover:text-[#22C55E] border border-slate-700/80 transition-all shadow-sm active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Voltar para o Painel
              </Link>
            </div>
            <h1 className="mt-4 text-3xl font-display font-extrabold sm:text-4xl">
              HUBBY — Política de Privacidade
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Sistema Integrado de Cotações (SIC) · Versão 1.0 · Vigência: Julho de 2026
            </p>

            {/* Quick Meta Info Box */}
            <div className="mt-8 grid grid-cols-1 gap-4 rounded-2xl bg-slate-800/60 p-5 text-xs sm:grid-cols-3 sm:gap-6">
              <div>
                <span className="text-slate-400">Controlador dos Dados:</span>
                <p className="font-semibold text-white">HUBBY TECNOLOGIA LTDA</p>
                <p className="text-slate-400">São Paulo, SP — Brasil</p>
              </div>
              <div>
                <span className="text-slate-400">Encarregado de Dados (DPO):</span>
                <p className="font-semibold text-[#22C55E]">privacidade@hubby.com.br</p>
                <p className="text-slate-400">Resposta em até 15 dias úteis</p>
              </div>
              <div>
                <span className="text-slate-400">Público desta Política:</span>
                <p className="font-semibold text-white">Compradores, Distribuidoras e Visitantes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            
            {/* Index Sidebar */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Sumário</h3>
                <nav className="space-y-1 text-xs">
                  {sections.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-[#F5F7FB] hover:text-[#2563EB] transition-colors"
                    >
                      {item.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Policy Text */}
            <main className="lg:col-span-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:p-12 text-slate-700 text-sm leading-relaxed space-y-8">
                
                {/* Intro */}
                <div className="rounded-2xl bg-blue-50/60 p-5 border border-blue-100 text-slate-700">
                  <p>
                    Esta Política de Privacidade descreve como a <strong>Hubby (SIC — Sistema Integrado de Cotações)</strong> coleta, usa, armazena, compartilha e protege os dados pessoais e empresariais dos usuários da plataforma, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong> e demais legislações aplicáveis.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="s1">
                  <SectionHeader number="1" title="Quem somos e como nos contatar" />
                  <p className="mb-4">
                    A Hubby (SIC — Sistema Integrado de Cotações) é uma plataforma de tecnologia B2B que conecta compradores de bebidas (bares, restaurantes, adegas, hotéis e estabelecimentos similares) com distribuidoras de bebidas no Brasil.
                  </p>
                  <p className="mb-4">
                    Para fins desta Política de Privacidade, a Hubby atua como <strong>Controladora de Dados</strong> — ou seja, é a responsável pelas decisões sobre como os dados pessoais e empresariais são coletados, tratados e utilizados dentro da plataforma.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mt-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Campo</th>
                          <th className="p-3 text-left">Informação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Razão social</td><td className="p-3">HUBBY TECNOLOGIA LTDA (CNPJ a ser registrado)</td></tr>
                        <tr><td className="p-3 font-medium">Endereço</td><td className="p-3">São Paulo, SP — Brasil</td></tr>
                        <tr><td className="p-3 font-medium">E-mail geral</td><td className="p-3"><a href="mailto:contato@hubby.com.br" className="text-[#2563EB] hover:underline">contato@hubby.com.br</a></td></tr>
                        <tr><td className="p-3 font-medium">E-mail privacidade (DPO)</td><td className="p-3"><a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] hover:underline">privacidade@hubby.com.br</a></td></tr>
                        <tr><td className="p-3 font-medium">Site oficial</td><td className="p-3"><a href="https://hubby.com.br" target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">https://hubby.com.br</a></td></tr>
                        <tr><td className="p-3 font-medium">Política de Privacidade</td><td className="p-3"><Link href="/privacidade" className="text-[#2563EB] hover:underline">https://hubby.com.br/privacidade</Link></td></tr>
                        <tr><td className="p-3 font-medium">Termos de Uso</td><td className="p-3"><Link href="/termos" className="text-[#2563EB] hover:underline">https://hubby.com.br/termos</Link></td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Encarregado de Dados (DPO)</h4>
                    <p className="mt-1 text-xs text-slate-600">
                      Nós indicamos um Encarregado pelo Tratamento de Dados Pessoais (DPO — Data Protection Officer) conforme exigido pelo Art. 41 da LGPD. Para qualquer dúvida, solicitação ou exercício de direitos relacionados a esta Política, entre em contato pelo e-mail: <a href="mailto:privacidade@hubby.com.br" className="font-semibold text-[#2563EB] hover:underline">privacidade@hubby.com.br</a>. Respondemos em até 15 dias úteis.
                    </p>
                  </div>
                </section>

                {/* Section 2 */}
                <section id="s2">
                  <SectionHeader number="2" title="Definições importantes" />
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left w-1/4">Termo</th>
                          <th className="p-3 text-left">Definição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium text-slate-900">Dado pessoal</td><td className="p-3">Qualquer informação relacionada a pessoa natural identificada ou identificável (Art. 5º, I, LGPD). Ex: nome, e-mail, CPF, telefone.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Dado pessoal sensível</td><td className="p-3">Dado pessoal sobre origem racial, convicção religiosa, opinião política, saúde, vida sexual, dado genético ou biométrico. A Hubby não coleta dados sensíveis intencionalmente.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Dado empresarial</td><td className="p-3">Informações sobre pessoas jurídicas (CNPJ, razão social, faturamento). Não são dados pessoais pela LGPD, mas são protegidos por sigilo comercial e contratual.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Consentimento</td><td className="p-3">Manifestação livre, informada e inequívoca do titular concordando com o tratamento dos seus dados.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Titular</td><td className="p-3">Pessoa natural a quem os dados pessoais se referem. Na Hubby: representantes legais, sócios e colaboradores das empresas cadastradas.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Controlador</td><td className="p-3">Pessoa ou empresa que decide como os dados serão tratados. A Hubby é a Controladora.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Operador</td><td className="p-3">Empresa que trata dados em nome do Controlador. Ex: SendGrid (e-mails), AWS/Supabase (banco de dados).</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">Tratamento</td><td className="p-3">Qualquer operação com dados: coleta, armazenamento, uso, compartilhamento, exclusão.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">LGPD</td><td className="p-3">Lei Geral de Proteção de Dados — Lei 13.709/2018. Legislação brasileira de proteção de dados pessoais.</td></tr>
                        <tr><td className="p-3 font-medium text-slate-900">ANPD</td><td className="p-3">Autoridade Nacional de Proteção de Dados. Órgão governamental responsável pela fiscalização da LGPD.</td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Section 3 */}
                <section id="s3">
                  <SectionHeader number="3" title="Quais dados coletamos e por que" />
                  <p className="mb-4">
                    Coletamos apenas os dados estritamente necessários para o funcionamento da plataforma, seguindo o princípio da minimização de dados previsto no Art. 6º, III, da LGPD.
                  </p>

                  <h3 className="mt-6 mb-3 text-base font-bold text-slate-900">3.1 Dados coletados de Compradores</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Dado coletado</th>
                          <th className="p-3 text-left">Finalidade</th>
                          <th className="p-3 text-left">Origem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Nome do responsável</td><td className="p-3">Identificação do usuário na plataforma</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">E-mail</td><td className="p-3">Login, comunicações e recuperação de senha</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">Senha (hash)</td><td className="p-3">Autenticação — armazenada em hash bcrypt 12, nunca em texto puro</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">CNPJ</td><td className="p-3">Identificação da empresa, validação na Receita Federal, análise de crédito</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">Razão social</td><td className="p-3">Nome oficial da empresa para documentos e NF-e</td><td className="p-3 text-slate-500">Pré-preenchido via Receita Federal</td></tr>
                        <tr><td className="p-3 font-medium">Telefone/WhatsApp</td><td className="p-3">Comunicação sobre pedidos e suporte</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">CEP e endereço</td><td className="p-3">Calcular regiões de entrega e filtrar distribuidoras disponíveis</td><td className="p-3 text-slate-500">Obrigatório para cotar</td></tr>
                        <tr><td className="p-3 font-medium">Tipo de estabelecimento</td><td className="p-3">Personalizar a experiência (bar, restaurante, adega, hotel)</td><td className="p-3 text-slate-500">Opcional no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">Histórico de cotações</td><td className="p-3">Recompra, relatórios, sugestão inteligente, histórico de preços</td><td className="p-3 text-slate-500">Gerado automaticamente</td></tr>
                        <tr><td className="p-3 font-medium">Avaliações de distribuidoras</td><td className="p-3">Qualidade do serviço das distribuidoras — exibidas publicamente</td><td className="p-3 text-slate-500">Opcional após pedido</td></tr>
                        <tr><td className="p-3 font-medium">Dados de pesquisa de onboarding</td><td className="p-3">Volume de compras, gasto mensal, principais dificuldades — para melhorar o produto</td><td className="p-3 text-slate-500">Opcional</td></tr>
                        <tr><td className="p-3 font-medium">Token de notificação push</td><td className="p-3">Envio de alertas de preço e promoções no celular</td><td className="p-3 text-slate-500">Gerado com permissão do usuário</td></tr>
                        <tr><td className="p-3 font-medium">Logs de acesso</td><td className="p-3">IP, data/hora de acesso, dispositivo — para segurança e auditoria</td><td className="p-3 text-slate-500">Automático</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="mt-6 mb-3 text-base font-bold text-slate-900">3.2 Dados coletados de Distribuidoras</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Dado coletado</th>
                          <th className="p-3 text-left">Finalidade</th>
                          <th className="p-3 text-left">Origem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Nome do responsável e colaboradores</td><td className="p-3">Identificação dos usuários no sistema</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">E-mail</td><td className="p-3">Login, notificações de pedidos, relatórios</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">CNPJ e dados fiscais</td><td className="p-3">Validação, credenciamento, cobrança da assinatura</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">Telefone/WhatsApp</td><td className="p-3">Notificação de novas cotações, suporte</td><td className="p-3 text-slate-500">Obrigatório no cadastro</td></tr>
                        <tr><td className="p-3 font-medium">Endereço da empresa</td><td className="p-3">Cálculo de regiões de entrega</td><td className="p-3 text-slate-500">Obrigatório</td></tr>
                        <tr><td className="p-3 font-medium">Catálogo de produtos e preços</td><td className="p-3">Exibição no ranking de cotações para compradores</td><td className="p-3 text-slate-500">Fornecido pela distribuidora</td></tr>
                        <tr><td className="p-3 font-medium">Regiões e rotas de entrega</td><td className="p-3">Filtrar distribuidoras por região do comprador</td><td className="p-3 text-slate-500">Fornecido pela distribuidora</td></tr>
                        <tr><td className="p-3 font-medium">Histórico de pedidos</td><td className="p-3">Gestão comercial, relatórios, score de atendimento</td><td className="p-3 text-slate-500">Gerado automaticamente</td></tr>
                        <tr><td className="p-3 font-medium">Feedbacks de pagamento</td><td className="p-3">Compor o score de crédito dos compradores</td><td className="p-3 text-slate-500">Fornecido voluntariamente</td></tr>
                        <tr><td className="p-3 font-medium">Chaves de API do ERP</td><td className="p-3">Integração com sistemas de gestão da distribuidora</td><td className="p-3 text-slate-500">Fornecido pela distribuidora</td></tr>
                        <tr><td className="p-3 font-medium">Dados de faturamento</td><td className="p-3">Cobrança da assinatura via Stripe</td><td className="p-3 text-slate-500">Fornecido no momento da assinatura</td></tr>
                        <tr><td className="p-3 font-medium">Score de atendimento</td><td className="p-3">Calculado com base em tempo de resposta e avaliações</td><td className="p-3 text-slate-500">Gerado automaticamente</td></tr>
                        <tr><td className="p-3 font-medium">Logs de acesso</td><td className="p-3">IP, data/hora, dispositivo — segurança e auditoria</td><td className="p-3 text-slate-500">Automático</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="mt-6 mb-3 text-base font-bold text-slate-900">3.3 Dados coletados de visitantes do site</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">Cookies de sessão</strong>
                      <p className="text-xs text-slate-600 mt-1">Manter o usuário logado durante a navegação (Automático).</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">Cookies de preferências</strong>
                      <p className="text-xs text-slate-600 mt-1">Lembrar configurações do usuário como tema e idioma (Automático).</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">Dados de analytics</strong>
                      <p className="text-xs text-slate-600 mt-1">Entender como os usuários navegam e melhorar o produto (Automático com consentimento).</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">IP e dados de dispositivo</strong>
                      <p className="text-xs text-slate-600 mt-1">Segurança, prevenção de fraudes e rate limiting (Automático).</p>
                    </div>
                  </div>
                </section>

                {/* Section 4 */}
                <section id="s4">
                  <SectionHeader number="4" title="Base legal para o tratamento dos dados" />
                  <p className="mb-4">
                    Todo tratamento de dados na Hubby possui uma base legal prevista na LGPD (Art. 7º e Art. 11). Não tratamos dados sem fundamento legal.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left w-1/3">Base legal</th>
                          <th className="p-3 text-left">Quando se aplica e Exemplos na Hubby</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-3 font-medium text-slate-900">Execução de contrato (Art. 7º, V)</td>
                          <td className="p-3">Dados necessários para prestar o serviço contratado. Cadastro de usuários, cotações, ranking de preços, envio de pedidos, histórico, relatórios mensais, notificações de pedidos.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-slate-900">Consentimento (Art. 7º, I)</td>
                          <td className="p-3">Dados tratados com autorização expressa do titular, que pode ser revogada a qualquer momento. Cookies de analytics, notificações push de marketing, pesquisa de onboarding, personalização avançada.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-slate-900">Interesse legítimo (Art. 7º, IX)</td>
                          <td className="p-3">Tratamento necessário para interesses legítimos do controlador ou de terceiros, desde que não prevaleçam os direitos do titular. Logs de segurança, prevenção de fraudes, rate limiting, melhoria do produto, detecção de abuso.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-slate-900">Cumprimento de obrigação legal (Art. 7º, II)</td>
                          <td className="p-3">Dados necessários para cumprir obrigações legais. Dados fiscais para emissão de NF-e, registros para auditoria fiscal, retenção de logs conforme Marco Civil da Internet (Lei 12.965/2014).</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-slate-900">Proteção ao crédito (Art. 7º, X)</td>
                          <td className="p-3">Dados para análise de crédito e prevenção de inadimplência. Score de crédito dos compradores, consulta a bureau de crédito (Serasa/BigDataCorp), histórico de pagamentos.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900">
                    <strong>Importante sobre consentimento:</strong> Quando o tratamento se basear em consentimento, você pode revogá-lo a qualquer momento sem prejuízo aos tratamentos realizados anteriormente. A revogação do consentimento para dados essenciais ao serviço pode resultar na impossibilidade de uso da plataforma.
                  </div>
                </section>

                {/* Section 5 */}
                <section id="s5">
                  <SectionHeader number="5" title="Como usamos os dados coletados" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h4 className="font-bold text-slate-900 text-sm mb-2 text-[#2563EB]">Prestação do serviço principal</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li>Exibir o ranking de preços de distribuidoras para os compradores</li>
                        <li>Calcular a sugestão inteligente de melhor combinação de distribuidoras</li>
                        <li>Registrar e organizar o histórico de cotações e pedidos</li>
                        <li>Gerar relatórios mensais de gastos para os compradores</li>
                        <li>Notificar distribuidoras sobre novas cotações recebidas</li>
                        <li>Calcular o score de crédito dos compradores para as distribuidoras</li>
                        <li>Verificar disponibilidade de produtos via integração com ERP</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h4 className="font-bold text-slate-900 text-sm mb-2 text-[#2563EB]">Comunicações transacionais</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li>E-mails de confirmação de cadastro e recuperação de senha</li>
                        <li>Notificações de novas cotações para distribuidoras</li>
                        <li>Alertas de queda de preço para compradores</li>
                        <li>Relatório mensal automático no dia 1º de cada mês</li>
                        <li>Notificações push de novas promoções e produtos na região</li>
                        <li>Lembretes de cotações pendentes de resposta</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h4 className="font-bold text-slate-900 text-sm mb-2 text-[#2563EB]">Segurança e prevenção de fraudes</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li>Autenticar os usuários e proteger as contas com JWT RS256</li>
                        <li>Aplicar rate limiting para prevenir ataques de força bruta</li>
                        <li>Detectar acessos suspeitos e bloquear IPs maliciosos</li>
                        <li>Manter logs de acesso conforme exigido pelo Marco Civil da Internet</li>
                        <li>Validar CNPJs na Receita Federal para prevenir cadastros fraudulentos</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h4 className="font-bold text-slate-900 text-sm mb-2 text-[#2563EB]">Financeiro, cobrança e melhoria</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li>Processar o pagamento das assinaturas via Stripe</li>
                        <li>Emitir recibos e faturas das assinaturas</li>
                        <li>Gerenciar upgrades, downgrades e cancelamentos de planos</li>
                        <li>Cumprir obrigações fiscais relacionadas às assinaturas</li>
                        <li>Analisar padrões de uso para melhorar a experiência e novos recursos</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Section 6 */}
                <section id="s6">
                  <SectionHeader number="6" title="Compartilhamento de dados com terceiros" />
                  <p className="mb-4">
                    <strong>Não vendemos dados pessoais a terceiros.</strong> Compartilhamos dados apenas quando necessário para a prestação do serviço ou quando exigido por lei, sempre com base legal adequada e mediante contratos de proteção de dados.
                  </p>

                  <h3 className="mt-6 mb-3 text-base font-bold text-slate-900">6.1 Compartilhamento entre usuários da plataforma</h3>
                  <div className="space-y-3 mb-6">
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <strong className="text-slate-900 text-xs font-bold">Comprador → Distribuidora (Execução do contrato):</strong>
                      <p className="text-xs text-slate-600 mt-1">
                        Quando o comprador envia uma cotação, a distribuidora recebe: nome da empresa, CNPJ, cidade, produtos solicitados e quantidades. O telefone/WhatsApp do comprador é exibido apenas se o comprador optar por contato direto.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <strong className="text-slate-900 text-xs font-bold">Distribuidora → Comprador (Execução do contrato):</strong>
                      <p className="text-xs text-slate-600 mt-1">
                        O comprador vê no ranking: nome da distribuidora, preços, prazo de entrega, pedido mínimo, frete, nota média de avaliação e badge de certificação Hubby. Telefone e e-mail da distribuidora não são exibidos diretamente — o contato ocorre pelo chat interno.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <strong className="text-slate-900 text-xs font-bold">Avaliações públicas (Consentimento):</strong>
                      <p className="text-xs text-slate-600 mt-1">
                        Avaliações de distribuidoras feitas por compradores são exibidas publicamente no ranking. O nome do comprador não é exibido — apenas a nota e comentário anonimizado.
                      </p>
                    </div>
                  </div>

                  <h3 className="mt-6 mb-3 text-base font-bold text-slate-900">6.2 Fornecedores e prestadores de serviço (Operadores)</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Fornecedor</th>
                          <th className="p-3 text-left">Serviço</th>
                          <th className="p-3 text-left">País</th>
                          <th className="p-3 text-left">Salvaguarda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Supabase / PostgreSQL</td><td className="p-3">Banco de dados — armazena todos os dados da plataforma</td><td className="p-3 font-mono">EUA</td><td className="p-3 text-slate-500">Cláusulas contratuais padrão SCCs</td></tr>
                        <tr><td className="p-3 font-medium">Vercel</td><td className="p-3">Hospedagem do sistema web e app</td><td className="p-3 font-mono">EUA</td><td className="p-3 text-slate-500">DPA assinado, aderente ao GDPR</td></tr>
                        <tr><td className="p-3 font-medium">SendGrid (Twilio)</td><td className="p-3">Envio de e-mails transacionais e relatórios</td><td className="p-3 font-mono">EUA</td><td className="p-3 text-slate-500">DPA assinado, Privacy Shield</td></tr>
                        <tr><td className="p-3 font-medium">Stripe</td><td className="p-3">Processamento de pagamentos das assinaturas</td><td className="p-3 font-mono">EUA</td><td className="p-3 text-slate-500">DPA assinado, PCI-DSS Nível 1</td></tr>
                        <tr><td className="p-3 font-medium">Cloudflare</td><td className="p-3">CDN, proteção DDoS, armazenamento de arquivos (R2)</td><td className="p-3 font-mono">EUA/Global</td><td className="p-3 text-slate-500">DPA assinado, aderente ao GDPR</td></tr>
                        <tr><td className="p-3 font-medium">Upstash (Redis)</td><td className="p-3">Cache de dados e controle de sessão</td><td className="p-3 font-mono">EUA</td><td className="p-3 text-slate-500">DPA assinado</td></tr>
                        <tr><td className="p-3 font-medium">Z-API</td><td className="p-3">Envio de notificações via WhatsApp</td><td className="p-3 font-mono">Brasil</td><td className="p-3 text-slate-500">Contrato de serviço</td></tr>
                        <tr><td className="p-3 font-medium">BigDataCorp / Serasa</td><td className="p-3">Consulta de crédito dos compradores</td><td className="p-3 font-mono">Brasil</td><td className="p-3 text-slate-500">Contrato com cláusulas LGPD</td></tr>
                        <tr><td className="p-3 font-medium">Expo / React Native</td><td className="p-3">Distribuição do app mobile</td><td className="p-3 font-mono">EUA</td><td className="p-3 text-slate-500">Termos de desenvolvedor</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="mt-6 mb-2 text-base font-bold text-slate-900">6.3 Compartilhamento por obrigação legal</h3>
                  <p className="text-xs text-slate-600">
                    Podemos compartilhar dados com autoridades governamentais, judiciário ou órgãos reguladores quando exigido por lei, ordem judicial ou regulamentação aplicável, incluindo a ANPD. Nesse caso, informaremos o titular sempre que legalmente possível.
                  </p>
                </section>

                {/* Section 7 */}
                <section id="s7">
                  <SectionHeader number="7" title="Transferência internacional de dados" />
                  <p className="mb-4">
                    Alguns de nossos fornecedores operam fora do Brasil, o que implica transferência internacional de dados conforme o Art. 33 da LGPD. Garantimos que essas transferências são realizadas apenas para países que proporcionam nível de proteção de dados adequado ou com salvaguardas contratuais específicas.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <strong className="text-slate-900 text-xs font-bold block mb-1">Países receptores:</strong>
                      <p className="text-xs text-slate-600">Estados Unidos da América — principal destino (Vercel, Supabase, Stripe, SendGrid, Cloudflare).</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <strong className="text-slate-900 text-xs font-bold block mb-1">Dados que ficam no Brasil:</strong>
                      <p className="text-xs text-slate-600">Dados de consulta ao Serasa/BigDataCorp, dados de nota fiscal (processados por sistemas nacionais).</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <strong className="text-slate-900 text-xs font-bold block mb-1">Salvaguardas utilizadas:</strong>
                    <p className="text-xs text-slate-600">
                      Cláusulas Contratuais Padrão (SCCs) aprovadas por autoridades de proteção de dados; Data Processing Agreements (DPAs) com cada fornecedor; Fornecedores certificados em padrões internacionais (ISO 27001, SOC 2, PCI-DSS).
                    </p>
                  </div>
                </section>

                {/* Section 8 */}
                <section id="s8">
                  <SectionHeader number="8" title="Por quanto tempo guardamos os dados" />
                  <p className="mb-4">
                    Mantemos os dados apenas pelo tempo necessário para as finalidades que justificaram sua coleta, respeitando os prazos legais de retenção. Após esse período, os dados são deletados ou anonimizados de forma irreversível.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Tipo de dado</th>
                          <th className="p-3 text-left">Período de retenção</th>
                          <th className="p-3 text-left">Fundamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Dados de cadastro (nome, e-mail, CNPJ)</td><td className="p-3">Enquanto a conta estiver ativa + 5 anos após o encerramento</td><td className="p-3 text-slate-500">Obrigação legal fiscal (Art. 205 CC)</td></tr>
                        <tr><td className="p-3 font-medium">Histórico de cotações e pedidos</td><td className="p-3">Enquanto a conta estiver ativa + 5 anos</td><td className="p-3 text-slate-500">Obrigação legal + interesse legítimo</td></tr>
                        <tr><td className="p-3 font-medium">Dados de pagamento</td><td className="p-3">Conforme exigido pelo Stripe e legislação fiscal — geralmente 5 anos</td><td className="p-3 text-slate-500">Obrigação legal</td></tr>
                        <tr><td className="p-3 font-medium">Logs de acesso e segurança</td><td className="p-3">6 meses — conforme Art. 15 do Marco Civil da Internet</td><td className="p-3 text-slate-500">Obrigação legal</td></tr>
                        <tr><td className="p-3 font-medium">Score de crédito dos compradores</td><td className="p-3">Enquanto o comprador tiver conta ativa + 2 anos</td><td className="p-3 text-slate-500">Proteção ao crédito</td></tr>
                        <tr><td className="p-3 font-medium">Dados de consulta ao bureau (Serasa)</td><td className="p-3">5 anos — conforme legislação de proteção ao crédito</td><td className="p-3 text-slate-500">Obrigação legal</td></tr>
                        <tr><td className="p-3 font-medium">Avaliações de distribuidoras</td><td className="p-3">Enquanto a distribuidora estiver ativa na plataforma</td><td className="p-3 text-slate-500">Interesse legítimo</td></tr>
                        <tr><td className="p-3 font-medium">Dados de cookies de analytics</td><td className="p-3">13 meses — conforme recomendação da ANPD</td><td className="p-3 text-slate-500">Consentimento</td></tr>
                        <tr><td className="p-3 font-medium">Chaves de API do ERP</td><td className="p-3">Enquanto a integração estiver ativa — deletadas imediatamente após desativação</td><td className="p-3 text-slate-500">Execução de contrato</td></tr>
                        <tr><td className="p-3 font-medium">Backups de banco de dados</td><td className="p-3">Até 30 dias — backups automáticos diários</td><td className="p-3 text-slate-500">Segurança operacional</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>Exclusão de conta:</strong> Quando você solicitar a exclusão da sua conta, iniciaremos o processo de anonimização ou exclusão dos dados dentro de 30 dias, exceto para dados que precisamos reter por obrigação legal (como registros fiscais pelo prazo de 5 anos). Dados anonimizados podem ser mantidos para fins estatísticos sem identificação do titular.
                  </p>
                </section>

                {/* Section 9 */}
                <section id="s9">
                  <SectionHeader number="9" title="Seus direitos como titular dos dados" />
                  <p className="mb-4">
                    A LGPD garante a você, como titular dos dados, os seguintes direitos (Art. 18). Todos podem ser exercidos através do e-mail <a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] font-semibold hover:underline">privacidade@hubby.com.br</a>. Respondemos em até 15 dias úteis.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">1. Confirmação e acesso</strong>
                      <p className="text-xs text-slate-600 mt-1">Solicitar a confirmação de que tratamos seus dados e receber uma cópia completa.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">2. Correção</strong>
                      <p className="text-xs text-slate-600 mt-1">Solicitar a correção de dados incompletos, inexatos ou desatualizados.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">3. Anonimização ou bloqueio</strong>
                      <p className="text-xs text-slate-600 mt-1">Solicitar que dados desnecessários sejam anonimizados, bloqueados ou eliminados.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">4. Portabilidade</strong>
                      <p className="text-xs text-slate-600 mt-1">Exportar seus dados em formato estruturado (JSON ou CSV) para outro serviço.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">5. Eliminação (Consentimento)</strong>
                      <p className="text-xs text-slate-600 mt-1">Eliminação dos dados tratados com consentimento, respeitados prazos legais.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">6. Informação de compartilhamento</strong>
                      <p className="text-xs text-slate-600 mt-1">Informações sobre com quem compartilhamos seus dados e em que medida.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">7. Revogação do consentimento</strong>
                      <p className="text-xs text-slate-600 mt-1">Revogar autorizações a qualquer momento sem afetar tratamentos anteriores.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">8. Oposição ao tratamento</strong>
                      <p className="text-xs text-slate-600 mt-1">Opor-se a tratamentos realizados com base em interesse legítimo.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">9. Revisão de decisões automatizadas</strong>
                      <p className="text-xs text-slate-600 mt-1">Revisão humana de decisões exclusivamente por algoritmos (ex: score de crédito).</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900">10. Petição à ANPD</strong>
                      <p className="text-xs text-slate-600 mt-1">Apresentar petição perante a ANPD em caso de descumprimento da LGPD.</p>
                    </div>
                  </div>
                </section>

                {/* Section 10 */}
                <section id="s10">
                  <SectionHeader number="10" title="Cookies e tecnologias de rastreamento" />
                  <p className="mb-4">
                    Utilizamos cookies e tecnologias similares para garantir o funcionamento da plataforma, personalizar a experiência e entender como os usuários interagem com o sistema.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Tipo</th>
                          <th className="p-3 text-left">Finalidade</th>
                          <th className="p-3 text-left">Base legal</th>
                          <th className="p-3 text-left">Duração</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Cookies essenciais</td><td className="p-3">Necessários para o funcionamento básico — sessão de login, segurança CSRF, preferências de idioma. Não podem ser desativados.</td><td className="p-3 text-slate-500">Execução de contrato</td><td className="p-3">Sessão (até fechar o browser)</td></tr>
                        <tr><td className="p-3 font-medium">Cookies de preferências</td><td className="p-3">Lembram suas configurações: tema, filtros salvos, última distribuidora usada.</td><td className="p-3 text-slate-500">Consentimento</td><td className="p-3">Até 1 ano</td></tr>
                        <tr><td className="p-3 font-medium">Cookies de analytics</td><td className="p-3">Entendemos como os usuários navegam para melhorar o produto. Dados anonimizados.</td><td className="p-3 text-slate-500">Consentimento</td><td className="p-3">Até 13 meses</td></tr>
                        <tr><td className="p-3 font-medium">Tokens JWT (HttpOnly)</td><td className="p-3">Cookie de autenticação — não acessível por JavaScript, protege contra XSS.</td><td className="p-3 text-slate-500">Execução de contrato</td><td className="p-3">24 horas</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>Como gerenciar seus cookies:</strong> Você pode gerenciar ou desativar cookies não essenciais a qualquer momento nas configurações do seu navegador ou pelo painel de preferências da Hubby. A desativação de cookies essenciais pode impedir o funcionamento da plataforma.
                  </p>
                </section>

                {/* Section 11 */}
                <section id="s11">
                  <SectionHeader number="11" title="Segurança dos dados" />
                  <p className="mb-4">
                    Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado, perda, destruição ou divulgação indevida, conforme o Art. 46 da LGPD.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900 block mb-1">Criptografia em trânsito e repouso</strong>
                      <p className="text-xs text-slate-600">HTTPS/TLS 1.3 gerenciado por Cloudflare. Dados sensíveis criptografados com AES-256-GCM no banco de dados.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900 block mb-1">Autenticação e Senhas</strong>
                      <p className="text-xs text-slate-600">JWT RS256 com chaves assimétricas (expira em 24h). Senhas em hash bcrypt custo 12, nunca em texto puro.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900 block mb-1">2FA e Rate Limiting</strong>
                      <p className="text-xs text-slate-600">TOTP disponível para distribuidoras. 5 tentativas de login por IP / 15 min com bloqueio de 30 min em abusos.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50">
                      <strong className="text-xs font-bold text-slate-900 block mb-1">Headers de Segurança e Acesso</strong>
                      <p className="text-xs text-slate-600">CSP, X-Frame-Options (DENY), HSTS, X-Content-Type-Options. Rotas separadas por perfil (comprador, distribuidora, admin).</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
                    <strong className="text-slate-900 block mb-1">Em caso de incidente de segurança:</strong>
                    Em caso de violação de dados que possa acarretar risco ou dano relevante aos titulares, a Hubby notificará a ANPD e os titulares afetados em prazo razoável (de até 72 horas), conforme exigido pelo Art. 48 da LGPD, com informações sobre a natureza do incidente, os dados envolvidos e as medidas tomadas.
                  </div>
                </section>

                {/* Section 12 */}
                <section id="s12">
                  <SectionHeader number="12" title="Dados de menores de idade" />
                  <p>
                    A Hubby é uma plataforma exclusivamente B2B destinada a empresas e seus representantes legais. <strong>Não coletamos intencionalmente dados de menores de 18 anos.</strong> O cadastro na plataforma exige CNPJ válido e ativo na Receita Federal, o que implica que o usuário deve ser representante legal de uma pessoa jurídica — o que pressupõe capacidade civil plena (idade mínima de 18 anos). Se tomarmos conhecimento de que coletamos inadvertidamente dados de menor de idade, deletaremos essas informações imediatamente. Em caso de suspeita, entre em contato pelo e-mail <a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] hover:underline">privacidade@hubby.com.br</a>.
                  </p>
                </section>

                {/* Section 13 */}
                <section id="s13">
                  <SectionHeader number="13" title="Score de crédito e análise de risco" />
                  <p className="mb-4">
                    A Hubby utiliza um sistema de score de crédito para auxiliar as distribuidoras na avaliação dos compradores. Esta seção descreve como esse sistema funciona e os direitos dos titulares.
                  </p>
                  
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Componente</th>
                          <th className="p-3 text-left">O que avalia</th>
                          <th className="p-3 text-left">Base legal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">Score Hubby interno</td><td className="p-3">Calculado com base no histórico de pagamentos reportado pelas próprias distribuidoras na plataforma. Inicia em 500 e varia com feedbacks.</td><td className="p-3 text-slate-500">Proteção ao crédito (Art. 7º, X) + Interesse legítimo</td></tr>
                        <tr><td className="p-3 font-medium">Consulta à Receita Federal</td><td className="p-3">Situação cadastral do CNPJ, data de abertura, porte da empresa. Realizada no cadastro e periodicamente.</td><td className="p-3 text-slate-500">Execução de contrato + obrigação legal</td></tr>
                        <tr><td className="p-3 font-medium">Consulta a bureau externo (Serasa/BigDataCorp)</td><td className="p-3">Protestos, restrições financeiras, score de mercado. Realizada no primeiro contato do comprador com uma distribuidora.</td><td className="p-3 text-slate-500">Proteção ao crédito (Art. 7º, X)</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="mb-4 text-xs text-slate-600">
                    <strong>Como o score é utilizado:</strong> O score é exibido para as distribuidoras como um indicador — verde, amarelo ou vermelho — para auxiliar na decisão de conceder crédito. A decisão final é sempre da distribuidora. A Hubby não bloqueia automaticamente compradores com base no score externo — apenas impede cadastros com CNPJ inapto, suspenso ou baixado.
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50"><strong>Conhecer o score:</strong> O comprador pode solicitar seu score interno Hubby e os feedbacks que o compõem.</div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50"><strong>Contestar informações:</strong> O comprador pode contestar feedbacks incorretos junto à Hubby, que irá apurar junto à distribuidora.</div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50"><strong>Revisão humana:</strong> O comprador pode solicitar revisão humana do score e da análise de crédito (Art. 20 LGPD).</div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50"><strong>Atualização:</strong> Dados de bureau externo são atualizados a cada 30 dias ou mediante solicitação.</div>
                  </div>
                </section>

                {/* Section 14 */}
                <section id="s14">
                  <SectionHeader number="14" title="Notificações e comunicações de marketing" />
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left">Tipo de comunicação</th>
                          <th className="p-3 text-left">O que inclui</th>
                          <th className="p-3 text-left">Base legal e como desativar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium">E-mails transacionais</td><td className="p-3">Confirmação de cadastro, recuperação de senha, confirmação de pedido, relatório mensal.</td><td className="p-3 text-slate-500">Execução de contrato — não desativável enquanto conta ativa.</td></tr>
                        <tr><td className="p-3 font-medium">Notificações de pedidos</td><td className="p-3">Alertas de novas cotações para distribuidoras, confirmações para compradores.</td><td className="p-3 text-slate-500">Execução de contrato — necessárias para o serviço.</td></tr>
                        <tr><td className="p-3 font-medium">Alertas de preço</td><td className="p-3">Notificações quando o preço de um produto favorito cair 10% ou mais.</td><td className="p-3 text-slate-500">Consentimento — desativável nas configurações do perfil.</td></tr>
                        <tr><td className="p-3 font-medium">Notificações de promoções</td><td className="p-3">Alertas sobre promoções de distribuidoras na região do comprador.</td><td className="p-3 text-slate-500">Consentimento — desativável nas configurações do perfil.</td></tr>
                        <tr><td className="p-3 font-medium">Novidades da plataforma</td><td className="p-3">E-mails sobre novos recursos, melhorias e atualizações importantes.</td><td className="p-3 text-slate-500">Interesse legítimo — descadastro no rodapé do e-mail.</td></tr>
                        <tr><td className="p-3 font-medium">Notificações push mobile</td><td className="p-3">Alertas de preço, promoções, novidades — enviados para o celular.</td><td className="p-3 text-slate-500">Consentimento — revogável nas configurações do celular.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>Descadastro:</strong> Para se descadastrar de comunicações de marketing, você pode: (1) clicar em "Descadastrar" no rodapé de qualquer e-mail, (2) desativar notificações nas configurações do perfil na plataforma, (3) enviar e-mail para <a href="mailto:privacidade@hubby.com.br" className="text-[#2563EB] hover:underline">privacidade@hubby.com.br</a>. E-mails transacionais essenciais ao serviço não podem ser desativados.
                  </p>
                </section>

                {/* Section 15 */}
                <section id="s15">
                  <SectionHeader number="15" title="Alterações nesta Política de Privacidade" />
                  <p className="mb-3">
                    Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças no serviço, na legislação ou nas nossas práticas de tratamento de dados.
                  </p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                    <strong className="text-slate-900 block">Como notificamos alterações significativas:</strong>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                      <li>Notificação por e-mail para todos os usuários cadastrados com pelo menos 30 dias de antecedência</li>
                      <li>Banner de aviso na plataforma web e no app mobile</li>
                      <li>A data da "Última atualização" no topo deste documento será atualizada</li>
                      <li>Para alterações que exijam novo consentimento, solicitaremos expressamente</li>
                    </ul>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    O uso continuado da plataforma após o período de notificação constitui aceitação das alterações. Caso não concorde com as mudanças, você pode encerrar sua conta antes da data de vigência das alterações.
                  </p>
                </section>

                {/* Section 16 */}
                <section id="s16">
                  <SectionHeader number="16" title="Como exercer seus direitos" />
                  <p className="mb-4">
                    Para exercer qualquer um dos direitos previstos na LGPD ou esclarecer dúvidas sobre esta Política, entre em contato com nosso Encarregado de Dados (DPO):
                  </p>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-6 text-xs space-y-3">
                    <div>
                      <span className="text-slate-400 font-semibold block">E-mail do DPO (Canal preferencial):</span>
                      <a href="mailto:privacidade@hubby.com.br" className="text-base font-bold text-[#2563EB] hover:underline">privacidade@hubby.com.br</a>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">E-mail geral:</span>
                      <a href="mailto:contato@hubby.com.br" className="font-semibold text-slate-700 hover:underline">contato@hubby.com.br</a>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Prazo de resposta:</span>
                      <p className="text-slate-700">Até 15 dias úteis para resposta inicial. Solicitações complexas podem levar até 30 dias.</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Como identificar sua solicitação:</span>
                      <p className="text-slate-700">Informe no e-mail: nome completo ou razão social, CNPJ ou e-mail cadastrado, descrição clara do direito que deseja exercer e documentos de identificação se necessário.</p>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-3">Processo de atendimento das solicitações em 5 etapas</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 text-xs text-center">
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="font-mono text-slate-400 font-bold block mb-1">Etapa 1</span>
                      <strong className="text-slate-900 block font-bold mb-1">Recebimento</strong>
                      <p className="text-[11px] text-slate-500">Confirmamos recebimento em até 2 dias úteis</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="font-mono text-slate-400 font-bold block mb-1">Etapa 2</span>
                      <strong className="text-slate-900 block font-bold mb-1">Verificação</strong>
                      <p className="text-[11px] text-slate-500">Confirmamos a identidade do titular</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="font-mono text-slate-400 font-bold block mb-1">Etapa 3</span>
                      <strong className="text-slate-900 block font-bold mb-1">Análise</strong>
                      <p className="text-[11px] text-slate-500">Avaliamos com base na LGPD e políticas</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="font-mono text-slate-400 font-bold block mb-1">Etapa 4</span>
                      <strong className="text-slate-900 block font-bold mb-1">Resposta</strong>
                      <p className="text-[11px] text-slate-500">Respondemos em até 15 dias úteis</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="font-mono text-slate-400 font-bold block mb-1">Etapa 5</span>
                      <strong className="text-slate-900 block font-bold mb-1">Recurso</strong>
                      <p className="text-[11px] text-slate-500">Petição à ANPD se insatisfeito</p>
                    </div>
                  </div>

                  <p className="mt-6 text-xs text-slate-500">
                    Se não ficar satisfeito com nossa resposta, você pode contatar a Autoridade Nacional de Proteção de Dados: <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">gov.br/anpd</a>.
                  </p>
                </section>

                {/* Footer Legal Notes */}
                <div className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-700">HUBBY — Sistema Integrado de Cotações</p>
                    <p>Esta Política de Privacidade é regida pela legislação brasileira. Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link href="/termos" className="text-[#2563EB] font-semibold hover:underline">Termos de Uso</Link>
                    <span>·</span>
                    <Link href="/suporte" className="text-[#2563EB] font-semibold hover:underline">Suporte</Link>
                  </div>
                </div>

              </div>
            </main>

          </div>
        </div>
      </div>
  );
}
