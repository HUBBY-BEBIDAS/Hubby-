import type { Role } from "@prisma/client";

export interface BuyerScores {
  P: number;
  A: number;
  E: number;
}

export interface DistributorScores {
  R: number;
  EF: number;
  C: number;
}

export type ScoreResult = {
  scores: Record<string, number>;
  percentages: Record<string, number>;
  highlighted: string[];
  order: string[];
};

// --- Questionários de Comprador ---
export const CLIENT_ONBOARDING_QUESTIONS = [
  {
    key: "decision_factor",
    title: "O que mais influencia sua decisão?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Menor preço", weights: { P: 3 } },
      { text: "Melhor custo-benefício", weights: { E: 3 } },
      { text: "Entrega mais rápida", weights: { A: 3 } },
      { text: "Depende da situação", weights: { E: 2, A: 1 } }
    ]
  },
  {
    key: "wait_to_save",
    title: "Esperaria 2 dias para economizar 10%?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Sim", weights: { P: 3 } },
      { text: "Depende", weights: { E: 3 } },
      { text: "Não", weights: { A: 3 } }
    ]
  },
  {
    key: "main_pain",
    title: "Qual sua maior dor hoje?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Preço", weights: { P: 3 } },
      { text: "Tempo", weights: { A: 3 } },
      { text: "Preço e prazo", weights: { E: 3 } },
      { text: "Disponibilidade", weights: { E: 2, A: 1 } }
    ]
  },
  {
    key: "improvement_area",
    title: "O que gostaria de melhorar?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Reduzir custos", weights: { P: 3 } },
      { text: "Comprar mais rápido", weights: { A: 3 } },
      { text: "Os dois", weights: { E: 3 } }
    ]
  },
  {
    key: "ideal_purchase_priority",
    title: "Em uma compra ideal você prioriza:",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Preço", weights: { P: 3 } },
      { text: "Prazo", weights: { A: 3 } },
      { text: "Equilíbrio", weights: { E: 3 } }
    ]
  },
  {
    key: "weekly_usage_driver",
    title: "O que faria você usar a Hubby toda semana?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Economizar dinheiro", weights: { P: 3 } },
      { text: "Ganhar tempo", weights: { A: 3 } },
      { text: "Os dois", weights: { E: 3 } }
    ]
  }
];

// --- Questionários de Distribuidora ---
export const DISTRIBUTOR_ONBOARDING_QUESTIONS = [
  {
    key: "main_goal",
    title: "Principal objetivo?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Vender mais", weights: { R: 3 } },
      { text: "Atender mais clientes", weights: { EF: 3 } },
      { text: "Reduzir custos", weights: { C: 3 } },
      { text: "Todos", weights: { R: 1, EF: 1, C: 1 } }
    ]
  },
  {
    key: "biggest_challenge",
    title: "Maior dificuldade?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Poucos pedidos", weights: { R: 3 } },
      { text: "Responder cotações", weights: { EF: 3 } },
      { text: "Custos", weights: { C: 3 } }
    ]
  },
  {
    key: "most_important_kpi",
    title: "Indicador mais importante?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Faturamento", weights: { R: 3 } },
      { text: "Produtividade", weights: { EF: 3 } },
      { text: "Margem", weights: { C: 3 } }
    ]
  },
  {
    key: "desire_to_increase",
    title: "O que deseja aumentar?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Receita", weights: { R: 3 } },
      { text: "Eficiência", weights: { EF: 3 } },
      { text: "Margem", weights: { C: 3 } }
    ]
  },
  {
    key: "problem_to_eliminate",
    title: "Qual problema eliminaria?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Poucas vendas", weights: { R: 3 } },
      { text: "Tempo de atendimento", weights: { EF: 3 } },
      { text: "Custos", weights: { C: 3 } }
    ]
  },
  {
    key: "success_measurement",
    title: "Como medirá o sucesso da Hubby?",
    subtitle: "Selecione uma das opções abaixo.",
    type: "single",
    options: [
      { text: "Receita", weights: { R: 3 } },
      { text: "Produtividade", weights: { EF: 3 } },
      { text: "Economia", weights: { C: 3 } }
    ]
  }
];

// --- Função para calcular scores ---
export function calculateScores(responses: Record<string, string>, role: Role): ScoreResult {
  const isDistributor = ["distributor_admin", "distributor_collaborator"].includes(role);
  const questions = isDistributor ? DISTRIBUTOR_ONBOARDING_QUESTIONS : CLIENT_ONBOARDING_QUESTIONS;

  const scores: Record<string, number> = isDistributor
    ? { R: 0, EF: 0, C: 0 }
    : { P: 0, A: 0, E: 0 };

  for (const q of questions) {
    const answer = responses[q.key];
    if (!answer) continue;

    const option = q.options.find((o) => o.text === answer);
    if (option) {
      for (const [key, val] of Object.entries(option.weights)) {
        if (scores[key] !== undefined) {
          scores[key] += val;
        }
      }
    }
  }

  const maxPoints = 18;
  const percentages: Record<string, number> = {};
  for (const [key, val] of Object.entries(scores)) {
    percentages[key] = Math.round((val / maxPoints) * 100);
  }

  const entries = Object.entries(scores);
  entries.sort((a, b) => b[1] - a[1]);

  const top1 = entries[0];
  const top2 = entries[1];
  const top3 = entries[2];

  const highlighted: string[] = [top1[0]];
  // Diferença de até 1 ponto (menos de 10% de 18) indica empate/destaque compartilhado
  if (top2 && Math.abs(top1[1] - top2[1]) <= 1) {
    highlighted.push(top2[0]);
    if (top3 && Math.abs(top1[1] - top3[1]) <= 1) {
      highlighted.push(top3[0]);
    }
  }

  const order = entries.map((e) => e[0]);

  return { scores, percentages, highlighted, order };
}

// --- Otimização Baseada em Comportamento Real ---
export function calculateBehavioralScores(
  activity: {
    orderCount: number;
    avgSavingsPct?: number;
    activeProductsCount?: number;
    responseTimeMinutes?: number;
  },
  role: Role
): ScoreResult {
  const isDistributor = ["distributor_admin", "distributor_collaborator"].includes(role);

  const responses: Record<string, string> = {};

  if (!isDistributor) {
    // Comprador behavior mapping
    if ((activity.avgSavingsPct ?? 0) > 15) {
      responses["decision_factor"] = "Menor preço";
      responses["wait_to_save"] = "Sim";
      responses["main_pain"] = "Preço";
      responses["improvement_area"] = "Reduzir custos";
      responses["ideal_purchase_priority"] = "Preço";
      responses["weekly_usage_driver"] = "Economizar dinheiro";
    } else if (activity.orderCount > 10) {
      responses["decision_factor"] = "Melhor custo-benefício";
      responses["wait_to_save"] = "Depende";
      responses["main_pain"] = "Preço e prazo";
      responses["improvement_area"] = "Os dois";
      responses["ideal_purchase_priority"] = "Equilíbrio";
      responses["weekly_usage_driver"] = "Os dois";
    } else {
      responses["decision_factor"] = "Entrega mais rápida";
      responses["wait_to_save"] = "Não";
      responses["main_pain"] = "Tempo";
      responses["improvement_area"] = "Comprar mais rápido";
      responses["ideal_purchase_priority"] = "Prazo";
      responses["weekly_usage_driver"] = "Ganhar tempo";
    }
  } else {
    // Distribuidora behavior mapping
    if ((activity.activeProductsCount ?? 0) > 100) {
      responses["main_goal"] = "Atender mais clientes";
      responses["biggest_challenge"] = "Responder cotações";
      responses["most_important_kpi"] = "Produtividade";
      responses["desire_to_increase"] = "Eficiência";
      responses["problem_to_eliminate"] = "Tempo de atendimento";
      responses["success_measurement"] = "Produtividade";
    } else if (activity.orderCount > 20) {
      responses["main_goal"] = "Vender mais";
      responses["biggest_challenge"] = "Poucos pedidos";
      responses["most_important_kpi"] = "Faturamento";
      responses["desire_to_increase"] = "Receita";
      responses["problem_to_eliminate"] = "Poucas vendas";
      responses["success_measurement"] = "Receita";
    } else {
      responses["main_goal"] = "Reduzir custos";
      responses["biggest_challenge"] = "Custos";
      responses["most_important_kpi"] = "Margem";
      responses["desire_to_increase"] = "Margem";
      responses["problem_to_eliminate"] = "Custos";
      responses["success_measurement"] = "Economia";
    }
  }

  return calculateScores(responses, role);
}
