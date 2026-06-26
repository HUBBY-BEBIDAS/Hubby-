@AGENTS.md

# CLAUDE.md — Hubby: Plataforma SaaS B2B de Cotação de Bebidas

*Atualizado em maio de 2026. Reler sempre que mudar de sessão.*

---

## Visão Geral do Produto

Plataforma SaaS B2B que digitaliza o processo de cotação e distribuição de bebidas no Brasil.
Conecta compradores (bares, restaurantes, adegas, mercados, hotéis, casas noturnas) com distribuidoras.

**Problema resolvido:** compradores cotavam manualmente para cada distribuidora por telefone ou WhatsApp.
Distribuidoras gastavam equipe recebendo pedidos repetitivos sem visibilidade de margem.

**Solução:** distribuidoras cadastram preços e condições uma vez. Compradores pesquisam e veem ranking
automático de cotações. Sistema calcula prazo real de entrega por rota e horário de corte.

**Modelo de receita:**
- Comprador **SEMPRE gratuito** (plano Free). Plano Pro disponível por R$ 99/mês.
- Receita principal via **assinatura das distribuidoras** (Starter a Enterprise).
- Sem comissão por venda. Nota fiscal sai diretamente pela distribuidora.

---

## Stack Técnica Atual

```
Runtime:    Next.js 16.2.6 (App Router, webpack mode) — ver AGENTS.md sobre breaking changes
Linguagem:  TypeScript strict (sem `any`)
Estilo:     Tailwind CSS 3.4
Banco:      PostgreSQL + Prisma ORM 7.7.0 (db push em dev, migrations em prod)
Auth:       NextAuth.js 4.24 — email+senha, Google OAuth; 2FA TOTP (speakeasy)
JWT:        jose 6.x — RS256; blacklist via Redis
Cache:      Redis (ioredis 5.x) — blacklist, ranking cache, rate limiting, CEP cache
Filas:      BullMQ 5.x sobre Redis — importação de planilhas em background
Storage:    AWS S3 (presigned URLs) — logos, documentos; fallback base64 em dev
Email:      nodemailer (SMTP em prod, ethereal em dev)
WhatsApp:   Z-API (mock em dev, integração real em prod)
Pagamento:  Stripe 22.x — assinaturas únicas por período (não recorrentes)
Bureau:     Mock determinístico por CNPJ (pronto para trocar por Serasa/Boa Vista)
Ícones:     lucide-react 1.14
Validação:  Zod 4.x
Senhas:     bcryptjs custo 12
2FA secret: AES-256-GCM (lib/encryption.ts)
```

**Comandos importantes:**
```bash
npm run dev            # Inicia servidor dev (porta 3000)
npx prisma db push     # Aplica schema sem migration (dev)
npx prisma generate    # Regera Prisma Client após mudança de schema
npx tsc --noEmit       # Verificação de tipos (deve passar sem erros)
npm run worker         # Worker BullMQ para importação de planilhas
npm run seed:realistic # Seed realista para desenvolvimento
```

**ATENÇÃO:** Após qualquer `prisma generate`, reiniciar o servidor dev para recarregar o Prisma Client em memória.

---

## Perfis de Usuário

| Role | Enum | Acesso |
|------|------|--------|
| Comprador | `client` | Cotação, ranking, catálogo, histórico, favoritos, lista de desejos |
| Distribuidora Admin | `distributor_admin` | Painel completo, produtos, regiões, equipe, promoções, relatórios |
| Distribuidora Colaborador | `distributor_collaborator` | Leads atribuídos + fila geral, sem acesso a configurações |
| Admin da Plataforma | `platform_admin` | Aprovação, métricas, cobertura, patrocínios, waitlist |

---

## Planos e Modelo de Negócio

### Distribuidoras

| Plano | Mensal | Trimestral | Semestral | Anual | Destaque |
|-------|--------|-----------|-----------|-------|----------|
| **Starter** | R$ 299 | R$ 269/mês | R$ 254/mês | R$ 239/mês | Canal básico de cotações |
| **Pro** | R$ 799 | R$ 719/mês | R$ 679/mês | R$ 639/mês | Colaboradores, analytics |
| **Business** | R$ 1.499 | R$ 1.349/mês | R$ 1.274/mês | R$ 1.199/mês | Equipe completa, webhooks ERP |
| **Enterprise** | Sob consulta | — | — | — | Tudo + gestão de vencimentos |

- Cobrança única por período (não recorrente mensal)
- Trial de 14 dias (somente plano mensal)
- Descontos: 10% trimestral, 15% semestral, 20% anual
- Enum no banco: `starter`, `pro`, `business`, `enterprise`
- Status: `trial`, `active`, `suspended`, `cancelled`, `pending_payment`

> **Atenção (retrocompatibilidade):** Código legado usa `vitrine` (= starter) e `operacional` (= pro). Há alias em `lib/stripe.ts`. Novas features devem usar os nomes novos.

### Compradores

| Plano | Mensal | Trimestral | Semestral | Anual |
|-------|--------|-----------|-----------|-------|
| **Free** | Grátis | — | — | — |
| **Pro** | R$ 99 | R$ 89/mês | R$ 84/mês | R$ 79/mês |

- Comprador **nunca é bloqueado** de cotar — Free acessa tudo essencial
- Pro desbloqueia: relatórios avançados, alertas de preço prioritários, programa de indicação (ambassador)

---

## Funcionalidades Implementadas

### Autenticação e Cadastro
- [x] Login email+senha com bcrypt custo 12
- [x] Google OAuth (NextAuth.js)
- [x] 2FA TOTP obrigatório para distribuidoras (QR code + speakeasy)
- [x] Logout com blacklist de token em Redis
- [x] Rate limiting: 5 tentativas/15 min por IP, bloqueio 30 min (login + register)
- [x] Cadastro de comprador com validação CNPJ via BrasilAPI
- [x] Cadastro de distribuidora com análise de crédito (bureau mock)
- [x] Recuperação e reset de senha por email
- [x] Programa de indicação: comprador gera código, distribuidora usa no cadastro

### Motor de Cotação
- [x] Criação de cotação com itens (produto, marca, categoria, embalagem, quantidade)
- [x] Ranking automático por distribuidora: menor preço, prazo, favorita do comprador
- [x] Cálculo de data de entrega real: cutoff_time + route_days + delivery_days_business
- [x] Filtro por prazo máximo configurado pelo comprador
- [x] Distribuidoras fora do prazo aparecem esmaecidas com tag "fora do prazo"
- [x] Cache de ranking: 5 min TTL, invalidação por produto
- [x] Cotação multi-distribuidora: pedidos enviados simultaneamente

### Catálogo de Produtos (Comprador)
- [x] Listagem com filtros: categoria, marca, faixa de preço, busca por texto
- [x] 4 opções de ordenação: mais barato, mais popular, lançamentos, promoções primeiro
- [x] Toggle grid/lista
- [x] Infinite scroll (IntersectionObserver)
- [x] Autocomplete de busca
- [x] Skeleton loading
- [x] Seções horizontais: frequentes, novidades (últimos 7 dias), similares (colaborativo)
- [x] Lista de desejos: ícone Heart no card, página `/lista-desejos`
- [x] Comparação lado a lado (2-3 produtos)
- [x] Badge de tendência de preço (↑↓) com percentual
- [x] Seção "Ofertas com prazo" (próximos ao vencimento, exclusivo Enterprise)
- [x] Vitrine patrocinada: top 3 sponsors injetados na página 1 do catálogo

### Gestão de Produtos (Distribuidora)
- [x] CRUD de produtos com categorias, embalagem, preço em centavos
- [x] Atualização inline de preços com alerta de variação (≥15% → popup vermelho)
- [x] Upload de planilha .xlsx em background (BullMQ): preview, validação, confirmação
- [x] Import de preços em lote (.xlsx)
- [x] Imagem do produto: upload direto S3 ou catálogo central Hubby
- [x] Promoções: desconto % ou preço fixo, por período

### Gestão de Vencimentos (Enterprise)
- [x] Campos: `expiry_date`, `expiry_alert_days`, `expiry_discount_pct`, `is_near_expiry`
- [x] Cron job diário (`POST /api/cron/expiry-check`) às 07h00
- [x] Produtos vencidos: desativação automática + NearExpiryOffer
- [x] Notificações: distribuidora (alert/urgente) + compradores favoritos (≤7 dias)
- [x] Painel `/painel/vencimentos` com status OK/Atenção/Urgente/Vencido
- [x] Para não-Enterprise: tela de bloqueio com CTA para upgrade
- [x] ERP integration: `POST /api/integrations/erp/batch` para atualizar lotes

### Regiões de Entrega
- [x] Cadastro por cidade/estado com prazo, dias de rota, horário de corte, pedido mínimo
- [x] Frete: free, fixo, por peso, por valor, personalizado
- [x] Import de planilha .xlsx (suporta 2 formatos: semanal e padrão)
- [x] Perfil da distribuidora: resumo consolidado "X regiões em Y estados" + botão Gerenciar
- [x] Lista completa apenas em `/painel/regioes`

### Credenciamento (Análise de Crédito)
- [x] Consulta bureau por CNPJ ao solicitar credencial
- [x] Cache 30 dias — nova consulta apenas após expirar
- [x] Critério de entrada Hubby: apenas CNPJ inapto/suspenso/baixado/nulo bloqueia cadastro
- [x] Score baixo → aprovado com aviso (indicador amarelo para distribuidoras)
- [x] Critério da distribuidora: score mínimo configurável, aceitar/rejeitar restrições, idade mínima do CNPJ
- [x] Score < 300 (piso da plataforma) → reprovação automática em qualquer distribuidora
- [x] Aprovação manual pelo distribuidor para casos pendentes

### Pedidos
- [x] Envio simultâneo para múltiplas distribuidoras (group_id)
- [x] Status: `sent`, `viewed`, `approved`, `rejected`, `delivered`
- [x] Snapshot de itens no momento do pedido
- [x] Recompra com 1 clique (reutiliza itens do pedido anterior)
- [x] Feedback de pagamento pós-pedido
- [x] Webhook para ERP da distribuidora ao receber pedido

### Equipe Comercial (Business+)
- [x] Convite de colaboradores por email
- [x] Roles: `all_clients` (fila geral) ou `assigned_clients` (carteira própria)
- [x] Lead sem atribuição: fila geral visível para todos
- [x] Primeiro a interagir assume o lead automaticamente
- [x] Colaborador desativado → clientes voltam para fila geral
- [x] Meta de vendas mensal por colaborador
- [x] Painel `/painel/equipe`

### Vitrine Patrocinada
- [x] Slots por tipo: `top_ranking`, `category_highlight`, `search_boost`
- [x] Filtro por cidade/estado da região do comprador
- [x] Top 3 patrocinadores injetados no topo do catálogo (página 1 apenas)
- [x] Contagem de impressões (fire-and-forget)
- [x] Painel `/painel/patrocinio` para distribuidoras
- [x] Admin em `/admin/patrocinios`

### Programa de Indicação
- [x] Comprador gera código único de 6 chars (sem I/O/0/1 ambíguos)
- [x] Distribuidora informa código no cadastro (campo opcional)
- [x] Recompensa: extensão de `pro_expires_at` do comprador
  - 1ª conversão: +30 dias
  - 2ª conversão: +60 dias
  - 3ª conversão: +90 dias
  - 4ª+: +30 dias
- [x] 3ª conversão ativa `is_ambassador = true`
- [x] Idempotência: `applyReferralReward` verifica status antes de aplicar

### Notificações
- [x] In-app: persistidas em banco (tabela `Notification`)
- [x] WhatsApp: mock em dev (Z-API em prod)
- [x] Email: nodemailer (SMTP em prod, ethereal em dev)
- [x] Tipos: new_order, order_status, credential_approved, credential_rejected, near_expiry_alert, urgent_expiry_alert, buyer_expiry_alert, price_drop_alert

### Relatórios
- [x] Relatório mensal automático do comprador (cron job)
- [x] Métricas: total cotações, pedidos, valor total, economia estimada, top distribuidoras, top produtos
- [x] Painel de relatórios da distribuidora
- [x] Admin: métricas globais, financeiro, lista de espera

### CEP e Localização
- [x] Lookup automático de CEP via ViaCEP (`GET /api/address/cep/[cep]`)
- [x] Cache 7 dias em Redis; CEPs inválidos cacheados 24h
- [x] Múltiplos endereços de entrega por comprador (`ClientDeliveryAddress`)
- [x] Cotação usa endereço de entrega automaticamente (sem input manual de CEP)
- [x] Geocodificação via Google Maps API

### Segurança
- [x] Security headers: CSP, HSTS 2 anos, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [x] Rate limiting em login e register: 5 tentativas/15 min/IP, bloqueio 30 min
- [x] JWT RS256 com blacklist em Redis
- [x] AES-256-GCM para secrets de 2FA
- [x] bcrypt custo 12 para senhas
- [x] Prisma parameterizado (zero SQL injection)
- [x] Upload: validação de MIME type + limite de tamanho
- [x] Stripe webhooks com validação de assinatura

---

## Schema do Banco de Dados — Modelos Principais

```
User              — email, role, 2FA, provider
Client            — comprador: CNPJ, endereço, referral_code, is_ambassador, pro_expires_at
Distributor       — distribuidora: plan, plan_status, business_hours, lat/lng, erp_api_key
Product           — produto: price_cents, expiry_date, is_near_expiry, image_url, image_source
Quotation         — cotação: status (draft/open/closed/expired), delivery_city/state
QuotationItem     — item: product_name, brand, category, packaging, quantity
Order             — pedido: group_id, status, items_snapshot, total_cents
DeliveryRegion    — região: city, state, route_days, cutoff_time, freight_type
ClientCredential  — credencial: status, credit_score, bureau_response, expires_at (30 dias)
Promotion         — promoção: type (percentage/fixed_price), starts_at, ends_at
NearExpiryOffer   — oferta vencimento: discount_pct, stock, expires_at
SponsoredSlot     — patrocínio: slot_type, region_city/state, budget_cents, impressions
DistributorTeamMember — equipe: role_scope, assigned_client_ids, sales_target
Referral          — indicação: referrer_id, referred_distributor_id, status
WishlistItem      — lista de desejos: product_key, product_name, brand, category
ClientDeliveryAddress — endereço salvo: zip_code, city, state, is_default
PriceHistory      — histórico de preço por produto/distribuidora/cliente
CartItem          — carrinho: client_id, product_id, distributor_id, quantity
Review            — avaliação: rating (geral + 3 dimensões), comment
PaymentFeedback   — feedback de pagamento pós-pedido
Notification      — notificação in-app: type, title, body, read, data
MonthlyReport     — relatório mensal do comprador
WebhookLog        — log de disparos de webhook para ERP
CoverageCity      — cidades com cobertura ativa na plataforma
Waitlist          — lista de espera para cidades sem cobertura
ProductCatalog    — catálogo central Hubby de imagens/referências
OnboardingSurvey  — pesquisa inicial do comprador (dores, frequência, etc.)
PriceAlert        — alerta de queda de preço por marca/categoria
FavoriteDistributor — distribuidoras favoritas do comprador
```

**Enums relevantes:**
- `Plan`: `starter | pro | business | enterprise`
- `PlanStatus`: `trial | active | suspended | cancelled | pending_payment`
- `ClientPlan`: `free | pro`
- `OrderStatus`: `sent | viewed | approved | rejected | delivered`
- `QuotationStatus`: `draft | open | closed | expired`
- `FreightType`: `free | fixed | by_weight | by_value | custom`
- `SponsoredSlotType`: `top_ranking | category_highlight | search_boost`
- `RoleScope`: `all_clients | assigned_clients`
- `ReferralStatus`: `pending | converted | expired`

---

## Regras de Negócio Críticas

### Preços
- Preços **sempre em centavos** (integer) — nunca float. R$ 12,90 = 1290
- Atualização até 09h00 diariamente
- Variação ≥ 15% → popup vermelho (alerta, não bloqueia)
- Variação 5–14% → popup normal
- Variação < 5% → salva direto sem popup
- Preço zero ou negativo → bloqueado

### Ranking de Cotações
- Distribuidoras fora da região → **nunca** aparecem
- Distribuidoras sem o produto disponível → não aparecem para aquele item
- Distribuidoras dentro do prazo: aparecem normalmente
- Distribuidoras fora do prazo: aparecem esmaecidas com tag
- Ordenação: 1) menor preço total, 2) prazo menor, 3) distribuidora favorita, 4) ordem alfabética

### Cálculo de Entrega
```
1. Verificar cutoff_time da distribuidora
2. Se agora <= cutoff → próxima rota é no próximo route_day desta semana
3. Se agora > cutoff → próxima rota é no route_day seguinte (pode ser semana que vem)
4. Somar delivery_days_business em dias úteis
5. Exibir DATA (ex: "quarta-feira, 09/07") — nunca só o número de dias
```

### Análise de Crédito — Hubby (cadastro do comprador)
- **Bloqueia**: CNPJ inapto/suspenso/baixado/nulo na Receita Federal
- **Aprova com aviso** (indicador amarelo): score < 500 ou restrições ativas
- **Aprova limpo**: score ≥ 500 e sem restrições
- Score, tempo de CNPJ e restrições **NÃO bloqueiam cadastro** — só geram indicador visual

### Análise de Crédito — Por Distribuidora (credenciamento)
- CNPJ irregular → reprovação automática imediata
- CNPJ jovem demais (< credit_min_cnpj_months) → reprovação automática
- Score < 300 (piso plataforma) → reprovação automática
- Restrições + distribuidora não aceita → revisão manual (pending)
- Score < credit_score_minimum da distribuidora → revisão manual (pending)
- Demais → aprovação automática
- Credencial válida por 30 dias → nova consulta ao bureau após expires_at

### Sessão e Autenticação
- Sessão JWT expira em 24 horas
- 2FA obrigatório para `distributor_admin` e `distributor_collaborator`
- Logout invalida token imediatamente via blacklist Redis
- Rate limiting compartilhado entre login e register (mesma contagem por IP)

### Colaboradores (Business+)
- Lead sem colaborador → fila geral (visível para todos)
- Primeiro a interagir assume automaticamente
- Colaborador desativado → clientes voltam para fila geral
- Somente `distributor_admin` pode reatribuir clientes

### Gestão de Vencimentos (Enterprise)
- Cron diário às 07h00 (`CRON_SECRET` no header Authorization)
- Produto vencido (daysLeft ≤ 0) → desativa produto + NearExpiryOffer
- daysLeft ≤ expiry_alert_days → ativa NearExpiryOffer com desconto
- daysLeft ≤ 7 → notificação urgente para distribuidora + compradores favoritos

### Programa de Indicação
- Qualquer comprador pode indicar, independente de plano
- Recompensa aplicada somente após pagamento confirmado (webhook Stripe)
- Não recompensa boleto (pagamento assíncrono)
- Idempotente: verifica `status !== "pending"` antes de aplicar

### Upload de Planilha
- Limite: 5.000 linhas por upload
- Processamento em background (BullMQ) — nunca bloqueia a requisição
- Validar fórmulas (células iniciadas com =, +, -, @): rejeitar
- Exibir resumo antes de confirmar: N novos, N atualizados, N com erro
- Nenhum dado importado sem confirmação do usuário

---

## Endpoints Principais da API

```
# Autenticação
POST   /api/auth/register          — cadastro (client ou distributor_admin)
POST   /api/auth/login             — login (via NextAuth credentials)
POST   /api/auth/logout            — logout + blacklist de token
POST   /api/auth/forgot-password   — solicita reset
POST   /api/auth/reset-password    — aplica reset
POST   /api/auth/2fa/setup         — gera QR code TOTP
POST   /api/auth/2fa/validate      — valida código TOTP na sessão

# Comprador
GET    /api/catalog                — catálogo com filtros, sort, paginação, patrocinados
GET    /api/catalog/frequentes     — top 6 mais cotados pelo comprador
GET    /api/catalog/novidades      — produtos adicionados nos últimos 7 dias
GET    /api/catalog/similares      — recomendação colaborativa
GET    /api/near-expiry            — ofertas com desconto por vencimento
GET    /api/wishlist               — lista de desejos
POST   /api/wishlist/:key          — adiciona à lista de desejos
DELETE /api/wishlist/:key          — remove da lista de desejos
GET    /api/address/cep/:cep       — lookup ViaCEP (cache 7 dias)
GET    /api/quotations             — histórico de cotações
POST   /api/quotations             — nova cotação
GET    /api/quotations/:id/ranking — ranking de distribuidoras para cotação
POST   /api/quotations/:id/send   — envia cotação para distribuidoras
GET    /api/orders                 — histórico de pedidos
POST   /api/orders/:group/reorder  — recompra
GET    /api/cart                   — carrinho
POST   /api/cart                   — adicionar item
GET    /api/favorites              — distribuidoras favoritas
POST   /api/onboarding-survey      — pesquisa de onboarding

# Distribuidora
GET    /api/distributor/dashboard          — KPIs do painel
GET    /api/distributor/products           — lista produtos
POST   /api/distributor/products           — criar produto
PATCH  /api/distributor/products/:id       — atualizar produto/preço
POST   /api/distributor/products/import    — upload .xlsx (preview)
POST   /api/distributor/products/import/confirm — confirmar importação
GET    /api/distributor/delivery-regions   — regiões de entrega
POST   /api/distributor/delivery-regions   — adicionar região
DELETE /api/distributor/delivery-regions/:id — remover região
POST   /api/distributor/delivery-regions/import — import .xlsx de regiões
GET    /api/distributor/orders             — pedidos recebidos
PATCH  /api/distributor/orders/:id/status  — atualizar status do pedido
GET    /api/distributor/credentials        — credenciais de compradores
PATCH  /api/distributor/credentials/:id/decide — aprovar/rejeitar credencial
GET    /api/distributor/promotions         — promoções ativas
POST   /api/distributor/promotions         — criar promoção
GET    /api/distributor/sponsored-slots    — slots patrocinados
POST   /api/distributor/sponsored-slots    — criar slot
GET    /api/distributor/reports            — relatórios
POST   /api/distributor/logo/presigned     — URL para upload de logo
GET    /api/team                           — membros da equipe
POST   /api/team                           — convidar colaborador
GET    /api/distributor/erp/config         — config webhook ERP
POST   /api/integrations/erp/batch        — webhook vencimentos (Enterprise)
POST   /api/integrations/erp/orders       — webhook pedidos (ERP externo)

# Admin
GET    /api/admin/distributors             — lista distribuidoras
PATCH  /api/admin/distributors/:id/approve — aprovar distribuidora
GET    /api/admin/metrics                  — KPIs globais
GET    /api/admin/compradores              — lista compradores
GET    /api/admin/cobertura                — cidades com cobertura
GET    /api/admin/lista-espera             — waitlist
GET    /api/admin/financeiro               — financeiro
GET    /api/admin/patrocinios              — patrocínios

# Billing
POST   /api/billing/checkout              — checkout distribuidora (Stripe)
POST   /api/billing/buyer/checkout        — checkout comprador Pro (Stripe)
POST   /api/billing/webhook               — webhook Stripe (assinaturas)

# Cron Jobs (autenticados via Authorization: Bearer <CRON_SECRET>)
POST   /api/cron/expiry-check             — verifica vencimentos (diário 07h00)
POST   /api/cron/monthly-reports          — gera relatórios mensais (1º de cada mês)
POST   /api/cron/payment-feedback         — processa feedback de pagamento
```

---

## Estrutura de Páginas

```
/                           — Homepage pública
/sobre                      — Sobre a empresa
/suporte                    — Suporte
/termos, /privacidade       — Documentos legais

/auth/login                 — Login
/auth/register              — Cadastro (client ou distributor_admin)
/onboarding                 — Completar cadastro pós-registro

# Comprador
/cotacao                    — Nova cotação
/cotacao/[id]               — Detalhe da cotação
/cotacao/[id]/ranking       — Ranking de distribuidoras
/historico                  — Histórico de pedidos
/catalogo                   — Catálogo com filtros, wishlist, compare
/lista-desejos              — Lista de desejos (WishlistItem)
/favoritas                  — Distribuidoras favoritas
/perfil/cliente             — Perfil do comprador
/checkout/comprador         — Checkout para plano Pro

# Distribuidora
/perfil                     — Perfil e configurações da distribuidora
/painel                     — Dashboard com KPIs
/painel/produtos            — Gestão de produtos + import xlsx
/painel/regioes             — Gestão de regiões de entrega
/painel/promocoes           — Promoções ativas
/painel/vencimentos         — Gestão de vencimentos (Enterprise)
/painel/credenciais         — Análise de crédito dos compradores
/painel/equipe              — Gestão de equipe comercial
/painel/patrocinio          — Slots patrocinados
/painel/notificacoes        — Notificações in-app
/painel/relatorios          — Relatórios

# Admin
/admin                      — Dashboard admin
/admin/distribuidoras       — Lista + aprovação de distribuidoras
/admin/compradores          — Lista de compradores
/admin/produtos             — Produtos
/admin/aprovacoes           — Fila de aprovação
/admin/financeiro           — Financeiro
/admin/cobertura            — Gestão de cobertura por cidade
/admin/lista-espera         — Waitlist
/admin/pesquisa             — Surveys
/admin/patrocinios          — Gestão de patrocínios
```

---

## Libs Utilitárias (`src/lib/`)

| Arquivo | Função |
|---------|--------|
| `auth.config.ts` | NextAuth: providers, callbacks, sessão JWT, 2FA gate |
| `bureau.ts` | Mock bureau (Serasa/Boa Vista): score, status CNPJ, `evaluateCredit`, `evaluateHubbyEntry` |
| `cnpj.ts` | Validação de CNPJ + consulta BrasilAPI |
| `coverage.ts` | Verifica cobertura por cidade/estado/nacional |
| `delivery-calculator.ts` | Cálculo de data real de entrega por rota |
| `email.ts` | Envio de emails transacionais (SMTP/ethereal) |
| `encryption.ts` | AES-256-GCM para secrets (2FA, documentos) |
| `excel-parser.ts` | Parser ExcelJS para produtos (valida fórmulas, limite 5k linhas) |
| `excel-regions-parser.ts` | Parser de regiões (2 formatos: semanal e padrão) |
| `monthly-report.ts` | Geração de relatório mensal do comprador |
| `notifications.ts` | Helpers para notificações in-app |
| `price-alerts.ts` | Detecção de queda de preço + notificação |
| `prisma.ts` | Singleton PrismaClient com adapter PostgreSQL |
| `queue.ts` | BullMQ: fila de importação de produtos |
| `ranking-cache.ts` | Cache de ranking com invalidação por produto (5 min TTL) |
| `ranking-engine.ts` | Motor de cotação: matching, cálculo de prazo, ordenação |
| `rate-limit.ts` | RateLimiterRedis/Memory: 5 req/15min/IP, bloqueio 30min |
| `redis.ts` | Cliente Redis com fallback in-memory (dev) |
| `referral.ts` | Geração de código, `ensureUniqueCode`, `applyReferralReward` |
| `storage.ts` | AWS S3 presigned URLs; fallback base64 em dev |
| `stripe.ts` | Cliente Stripe + tabela de preços por plano/período |
| `webhook.ts` | Disparador de webhooks para ERP (fire-and-forget) |
| `whatsapp.ts` | Envio WhatsApp (mock em dev, Z-API em prod) |
| `with-auth.ts` | Middleware HOF: extrai user do Bearer JWT, verifica role |

---

## Variáveis de Ambiente Esperadas

```bash
# Banco
DATABASE_URL=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEXTAUTH_PRIVATE_KEY=       # RS256 — chave privada PEM
NEXTAUTH_PUBLIC_KEY=        # RS256 — chave pública PEM
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Redis
REDIS_URL=

# Storage S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_QUARTERLY=
STRIPE_PRICE_STARTER_SEMIANNUAL=
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_QUARTERLY=
STRIPE_PRICE_PRO_SEMIANNUAL=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_BUSINESS_MONTHLY=
STRIPE_PRICE_BUSINESS_QUARTERLY=
STRIPE_PRICE_BUSINESS_SEMIANNUAL=
STRIPE_PRICE_BUSINESS_ANNUAL=
STRIPE_PRICE_BUYER_PRO_MONTHLY=
STRIPE_PRICE_BUYER_PRO_QUARTERLY=
STRIPE_PRICE_BUYER_PRO_SEMIANNUAL=
STRIPE_PRICE_BUYER_PRO_ANNUAL=

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# WhatsApp
ZAPI_TOKEN=
ZAPI_INSTANCE=

# Cron
CRON_SECRET=

# Criptografia (2FA secrets)
ENCRYPTION_KEY=     # 32 bytes hex

# Bureau
BUREAU_API_KEY=     # Serasa ou Boa Vista (não usado no mock)

# Google Maps
GOOGLE_MAPS_API_KEY=
```

---

## Convenções de Código

- TypeScript strict — **zero `any`** — tipar tudo explicitamente
- Prisma para todas as queries — **nunca SQL raw** concatenado com input do usuário
- Preços **sempre em centavos** (Int) — nunca float
- UUIDs como primary keys — nunca IDs sequenciais expostos em URLs
- `.env` nunca commitado — usar `.env.example` sem valores reais
- Comentários em português, código em inglês
- `withAuth(handler, { roles: ["..."] })` em todos os endpoints protegidos
- Zod v4 para validação de body em todos os endpoints que recebem dados
- Commits em português descritivos

---

## Segurança — Regras Inegociáveis

- Documentos: AES-256-GCM, URLs assinadas S3 (expiram 15 min)
- Senhas: bcrypt custo 12 — nunca texto puro
- Secret 2FA: criptografado antes de salvar
- Banco não exposto à internet — apenas via VPC
- Cartão de crédito **nunca** armazenado — Stripe gerencia tudo
- HTTPS obrigatório — TLS 1.2+
- JWT assinado RS256 — chave privada em secrets manager
- SQL Injection: Prisma com queries parametrizadas sempre
- XSS: nunca `dangerouslySetInnerHTML` com input do usuário
- Upload: validar MIME type real, limite 10MB
- LGPD: consentimento no primeiro acesso, exclusão em 30 dias

---

## Próximos Passos Pendentes

### Alta Prioridade
- [ ] Substituir mock bureau por integração real (Serasa Experian ou Boa Vista SCPC)
- [ ] Substituir mock WhatsApp por Z-API em produção
- [ ] Configurar Vercel Cron Jobs para `expiry-check`, `monthly-reports`, `payment-feedback`
- [ ] Testes E2E no fluxo de cotação → ranking → envio → pedido
- [ ] CI/CD com `npx tsc --noEmit` e `npm run lint` bloqueantes

### Médio Prazo
- [ ] Landing page: atualizar seção de planos com nomes novos (Starter/Pro/Business/Enterprise)
- [ ] Página de perfil do comprador: seção do programa de indicação (exibir código + contador)
- [ ] Página pública `/indicacao/:code` para distribuidoras novatas
- [ ] Analytics da vitrine patrocinada (CTR, ROI por slot)
- [ ] Relatório de equipe: ranking de conversões por colaborador
- [ ] Alertas de preço: notificação push quando produto da wishlist baixa de preço
- [ ] Carrinho persistente: sincronizar entre sessões

### Baixa Prioridade / Fora do MVP
- [ ] App mobile iOS e Android
- [ ] Reajuste de preço em lote por percentual
- [ ] Exportação de relatórios em CSV/Excel
- [ ] Integração com ERP via OAuth2 (além de webhook API key)
- [ ] Marketplace de documentos de crédito (upload pelo comprador)

---

*Atualizado em 2026-05-13. Próxima atualização ao concluir integrações reais (bureau + WhatsApp).*
