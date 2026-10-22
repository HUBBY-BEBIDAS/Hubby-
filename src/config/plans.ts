
export type PlanPeriod = "monthly" | "semiannual" | "annual";

export const PERIOD_LABELS: Record<PlanPeriod, string> = {
  monthly:    "Mensal",
  semiannual: "Semestral",
  annual:     "Anual",
};

export const PERIOD_MONTHS: Record<PlanPeriod, number> = {
  monthly:    1,
  semiannual: 6,
  annual:     12,
};

export const PERIOD_DISCOUNTS: Record<PlanPeriod, number> = {
  monthly:    0,
  semiannual: 15,
  annual:     20,
};

// ─── Planos de Distribuidora ───────────────────────────────────────────────────

export type DistributorPlanKey = "starter" | "pro" | "enterprise";

export interface DistributorPlanConfig {
  key: DistributorPlanKey;
  name: string;
  tagline: string;
  badge?: string;
  highlight?: boolean;
  ctaText: string;
  isCustomQuote?: boolean; // Enterprise "Sob consulta"
  prices: {
    monthlyCents: number;
    semiannualCents: number; // cobrado a cada 6 meses
    annualCents: number;     // cobrado anualmente
  };
  monthlyEquivalents: {
    monthlyCents: number;
    semiannualCents: number;
    annualCents: number;
  };
  featureList: string[];
  flags: {
    canImportBulkCatalog: boolean;      // Importação/atualização em massa CSV/XLSX
    canImportBulkPrices: boolean;       // Importação rápida de preços em lote
    hasAssistedOnboarding: boolean;     // Equipe Bébbi sobe catálogo
    hasDedicatedOnboarding: boolean;    // Onboarding dedicado
    maxUsers: number;                   // 1 no Starter, 5 no Pro, Infinity no Enterprise
    hasTeamPermissions: boolean;        // Permissões por usuário
    hasTeamHierarchy: boolean;          // Hierarquia de equipes
    reportsLevel: "basic" | "complete" | "advanced";
    hasVerifiedBadge: boolean;          // Selo de distribuidora verificada
    hasTiebreakPriority: boolean;       // Prioridade em empate técnico no ranking
    hasErpIntegration: boolean;         // Webhook ERP (preço e estoque)
    hasExpiryManagement: boolean;       // Gestão automática de vencimentos + promoções
    hasUrgentBuyerNotification: boolean;// Notificação a compradores em modo urgente (≤7 dias)
    supportTier: "email" | "priority" | "dedicated_sla";
  };
}

export const DISTRIBUTOR_PLANS: Record<DistributorPlanKey, DistributorPlanConfig> = {
  starter: {
    key: "starter",
    name: "Starter",
    tagline: "A distribuidora faz tudo sozinha, com autonomia total.",
    ctaText: "Começar com Starter",
    prices: {
      monthlyCents:    29900, // R$ 299/mês
      semiannualCents: 152400, // 254 * 6 = R$ 1.524
      annualCents:     286800, // 239 * 12 = R$ 2.868
    },
    monthlyEquivalents: {
      monthlyCents:    29900, // R$ 299/mês
      semiannualCents: 25400, // R$ 254/mês (-15% arredondado para baixo)
      annualCents:     23900, // R$ 239/mês (-20% arredondado para baixo)
    },
    featureList: [
      "Perfil e portfólio completo na plataforma",
      "Catálogo e preços item a item",
      "Onboarding autoatendimento (tutorial/FAQ)",
      "Chat interno com o comprador",
      "Alerta de cotação (e-mail + alarme no PC)",
      "1 usuário de acesso",
      "Painel com métricas básicas",
      "Suporte por e-mail",
    ],
    flags: {
      canImportBulkCatalog:       false,
      canImportBulkPrices:        false,
      hasAssistedOnboarding:      false,
      hasDedicatedOnboarding:     false,
      maxUsers:                   1,
      hasTeamPermissions:         false,
      hasTeamHierarchy:           false,
      reportsLevel:               "basic",
      hasVerifiedBadge:           false,
      hasTiebreakPriority:        false,
      hasErpIntegration:          false,
      hasExpiryManagement:        false,
      hasUrgentBuyerNotification: false,
      supportTier:                "email",
    },
  },

  pro: {
    key: "pro",
    name: "Pro",
    tagline: "A equipe Bébbi configura e sobe o catálogo com você.",
    badge: "Mais escolhido",
    highlight: true,
    ctaText: "Começar com o Pro",
    prices: {
      monthlyCents:    59900, // R$ 599/mês
      semiannualCents: 305400, // 509 * 6 = R$ 3.054
      annualCents:     574800, // 479 * 12 = R$ 5.748
    },
    monthlyEquivalents: {
      monthlyCents:    59900, // R$ 599/mês
      semiannualCents: 50900, // R$ 509/mês (-15% arredondado para baixo)
      annualCents:     47900, // R$ 479/mês (-20% arredondado para baixo)
    },
    featureList: [
      "Tudo do Starter",
      "Importação/atualização em massa por planilha (CSV/XLSX)",
      "Onboarding assistido: equipe Bébbi sobe o catálogo",
      "Até 5 usuários com permissões",
      "Histórico completo de cotações + relatórios",
      "Selo de distribuidora verificada",
      "Prioridade em empate técnico no ranking",
      "Suporte prioritário",
    ],
    flags: {
      canImportBulkCatalog:       true,
      canImportBulkPrices:        true,
      hasAssistedOnboarding:      true,
      hasDedicatedOnboarding:     false,
      maxUsers:                   5,
      hasTeamPermissions:         true,
      hasTeamHierarchy:           false,
      reportsLevel:               "complete",
      hasVerifiedBadge:           true,
      hasTiebreakPriority:        true,
      hasErpIntegration:          false,
      hasExpiryManagement:        false,
      hasUrgentBuyerNotification: false,
      supportTier:                "priority",
    },
  },

  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Para operações de grande volume com automação total e integração ERP.",
    ctaText: "Falar com vendas",
    isCustomQuote: true,
    prices: {
      monthlyCents:    0,
      semiannualCents: 0,
      annualCents:     0,
    },
    monthlyEquivalents: {
      monthlyCents:    0,
      semiannualCents: 0,
      annualCents:     0,
    },
    featureList: [
      "Tudo do Pro",
      "Integração ERP via webhook (preço e estoque em tempo real)",
      "Gestão automática de vencimentos + promoções",
      "Notificação aos compradores em modo urgente (≤7 dias)",
      "Usuários ilimitados + hierarquia de equipes",
      "Relatórios avançados e exportação de dados",
      "Onboarding e gerente de contas dedicado",
      "SLA garantido de atendimento",
    ],
    flags: {
      canImportBulkCatalog:       true,
      canImportBulkPrices:        true,
      hasAssistedOnboarding:      true,
      hasDedicatedOnboarding:     true,
      maxUsers:                   Infinity,
      hasTeamPermissions:         true,
      hasTeamHierarchy:           true,
      reportsLevel:               "advanced",
      hasVerifiedBadge:           true,
      hasTiebreakPriority:        true,
      hasErpIntegration:          true,
      hasExpiryManagement:        true,
      hasUrgentBuyerNotification: true,
      supportTier:                "dedicated_sla",
    },
  },
};

// ─── Planos de Comprador (Bar / Restaurante) ───────────────────────────────────

export type BuyerPlanKey = "free" | "pro";
export type BuyerPeriodKey = "monthly" | "annual";

export interface BuyerPlanConfig {
  key: BuyerPlanKey;
  name: string;
  tagline: string;
  badge?: string;
  ctaText: string;
  pricing: {
    monthlyCents: number;
    annualTotalCents: number;
    annualMonthlyEquivalentCents: number;
  };
  featureList: string[];
}

export const BUYER_PLANS: Record<BuyerPlanKey, BuyerPlanConfig> = {
  free: {
    key: "free",
    name: "Free",
    tagline: "Tudo que seu bar ou restaurante precisa para cotar com agilidade.",
    ctaText: "Criar conta grátis",
    pricing: {
      monthlyCents:                 0,
      annualTotalCents:             0,
      annualMonthlyEquivalentCents: 0,
    },
    featureList: [
      "Cadastro e cotações sempre grátis",
      "Ranking automático de preços e prazos",
      "Chat direto com distribuidoras",
      "Histórico de cotações e pedidos",
      "Recompra em 1 clique",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    tagline: "Inteligência de compras, alertas e economia máxima.",
    badge: "Pro a partir de R$ 14,90",
    ctaText: "Assinar Pro",
    pricing: {
      monthlyCents:                 1990,  // R$ 19,90/mês
      annualTotalCents:             17880, // R$ 178,80/ano
      annualMonthlyEquivalentCents: 1490,  // R$ 14,90/mês no anual
    },
    featureList: [
      "Tudo do Gratuito",
      "Histórico completo e avançado de cotações",
      "Recompra em 1 clique acelerada",
      "Listas salvas e produtos favoritos",
      "Alertas automáticos de variação de preço",
      "Relatório mensal de economia gerada",
      "Múltiplos endereços de entrega",
      "Suporte prioritário",
    ],
  },
};

// ─── Status do Onboarding Pro (Admin) ──────────────────────────────────────────

export type OnboardingStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO";

export const ONBOARDING_STATUS_CONFIG: Record<
  OnboardingStatus,
  { label: string; badgeClass: string }
> = {
  PENDENTE:     { label: "Pendente",     badgeClass: "bg-amber-500/10 text-amber-500 border border-amber-500/20" },
  EM_ANDAMENTO: { label: "Em andamento", badgeClass: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
  CONCLUIDO:    { label: "Concluído",    badgeClass: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" },
};

// ─── Helpers de Formatação e Checagem ─────────────────────────────────────────

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatBRLDecimals(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Retorna as flags e limites de um plano de distribuidora.
 * Se o plano não for reconhecido, assume 'starter'.
 */
export function getDistributorPlanFlags(planKey?: string | null) {
  const normalized = (planKey ?? "").toLowerCase() as DistributorPlanKey;
  const config = DISTRIBUTOR_PLANS[normalized] ?? DISTRIBUTOR_PLANS.starter;
  return config.flags;
}

/**
 * Verifica se um plano possui uma feature específica.
 */
export function hasDistributorFeature<K extends keyof DistributorPlanConfig["flags"]>(
  planKey: string | null | undefined,
  feature: K
): DistributorPlanConfig["flags"][K] {
  return getDistributorPlanFlags(planKey)[feature];
}
