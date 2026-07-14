/**
 * Bureau de crédito — mock para desenvolvimento.
 * Critério de entrada Hubby separado dos critérios por distribuidora.
 *
 * A integração real (Serasa Experian / Boa Vista SCPC) é feita
 * trocando apenas a função `queryBureau` abaixo, mantendo o mesmo contrato.
 *
 * Comportamento do mock (determinístico por CNPJ, reproduzível em testes):
 *   - Score 0–999 derivado dos dígitos do CNPJ
 *   - CNPJ terminado em "00" → INAPTA  (para testar reprovação por status)
 *   - CNPJ terminado em "11" → SUSPENSA (para testar reprovação por status)
 *   - CNPJ terminado em "22" → BAIXADA  (para testar reprovação por status)
 *   - Demais → ATIVA
 *   - restrictions = score < 400
 *   - cnpj_months derivado dos primeiros dígitos (12–96 meses)
 */

export type BureauResponse = {
  score: number;           // 0–1000
  cnpj_status: string;     // "ATIVA" | "INAPTA" | "SUSPENSA" | "BAIXADA" | "NULA"
  cnpj_months: number;     // meses de existência do CNPJ
  restrictions: boolean;   // restrições financeiras ativas no bureau
  queried_at: string;      // ISO timestamp da consulta
};

/** Sufixos de CNPJ que mapeiam para status irregulares no mock */
const IRREGULAR_STATUS: Record<string, string> = {
  "00": "INAPTA",
  "11": "SUSPENSA",
  "22": "BAIXADA",
  "33": "NULA",
};

/**
 * Gera score determinístico a partir dos dígitos do CNPJ.
 * Usa uma variação do hash djb2 truncada em 0–999.
 */
function deriveMockScore(cnpj: string): number {
  const digits = cnpj.replace(/\D/g, "");
  let hash = 5381;
  for (const ch of digits) {
    hash = ((hash << 5) + hash + parseInt(ch)) >>> 0; // uint32
  }
  return hash % 1000;
}

/**
 * Gera meses determinísticos a partir dos primeiros 8 dígitos (raiz do CNPJ).
 * Resultado: 12–120 meses.
 */
function deriveMockMonths(cnpj: string): number {
  const root = cnpj.replace(/\D/g, "").slice(0, 8);
  let sum = 0;
  for (const ch of root) sum += parseInt(ch);
  return 12 + (sum % 109); // 12 a 120
}

/**
 * Consulta o bureau de crédito para um CNPJ.
 *
 * Em produção: substitua o corpo desta função pela chamada HTTP real
 * ao Serasa Experian API ou Boa Vista SCPC, mantendo o tipo de retorno.
 */
export async function queryBureau(cnpj: string): Promise<BureauResponse> {
  // Simula latência realista da API externa (100–400 ms)
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));

  const cleanCnpj = cnpj.replace(/\D/g, "");
  const suffix = cleanCnpj.slice(-2);

  const cnpj_status = IRREGULAR_STATUS[suffix] ?? "ATIVA";
  const score = deriveMockScore(cleanCnpj);
  const cnpj_months = deriveMockMonths(cleanCnpj);
  const restrictions = score < 400;

  return {
    score,
    cnpj_status,
    cnpj_months,
    restrictions,
    queried_at: new Date().toISOString(),
  };
}

// ─── Constantes de decisão ───────────────────────────────────────────────────

/** Score abaixo desse valor → reprovação automática (piso da plataforma) */
export const PLATFORM_SCORE_FLOOR = 300;

/** Score padrão de aprovação automática quando distribuidor não configurou o seu */
export const PLATFORM_SCORE_DEFAULT = 500;

/** Status de CNPJ que implicam reprovação automática */
export const IRREGULAR_CNPJ_STATUSES = new Set(["INAPTA", "SUSPENSA", "BAIXADA", "NULA"]);

// ─── Critério de entrada Hubby (cadastro do comprador) ───────────────────────

/** Score abaixo desse valor → cadastro aprovado com aviso (indicador amarelo para distribuidoras) */
export const HUBBY_SCORE_WARN = 500;

/**
 * Única mensagem de bloqueio no cadastro: CNPJ inapto/suspenso/baixado na Receita Federal.
 * Score baixo, tempo de CNPJ e restrições NÃO bloqueiam — apenas geram indicador visual.
 */
export const HUBBY_REJECTION_MESSAGE =
  "Não foi possível completar seu cadastro. Seu CNPJ está com situação irregular junto à Receita Federal " +
  "(inapto, suspenso ou baixado). Regularize a situação e tente novamente. Dúvidas: contato@hubby.com.br";

export type HubbyEntryDecision =
  | { outcome: "rejected"; reason: string }
  | { outcome: "approved_with_warning"; reason: string }
  | { outcome: "approved_clean" };

/**
 * Avalia o critério de entrada Hubby para um comprador no cadastro.
 *
 * Única restrição de bloqueio: CNPJ com situação irregular na Receita Federal.
 * Score, tempo de CNPJ e restrições de bureau NÃO bloqueiam o cadastro —
 * apenas definem o indicador visual (verde/amarelo) exibido às distribuidoras.
 */
export function evaluateHubbyEntry(bureau: BureauResponse): HubbyEntryDecision {
  // Única causa de rejeição: empresa irregular na Receita Federal
  if (IRREGULAR_CNPJ_STATUSES.has(bureau.cnpj_status)) {
    return { outcome: "rejected", reason: `CNPJ com situação irregular: ${bureau.cnpj_status}` };
  }

  // Score baixo, CNPJ jovem ou restrições → aprovado com aviso (indicador amarelo)
  if (bureau.score < HUBBY_SCORE_WARN || bureau.restrictions) {
    return { outcome: "approved_with_warning", reason: "Cadastro aprovado com indicadores de atenção" };
  }

  return { outcome: "approved_clean" };
}

export type CreditDecision =
  | { outcome: "approved" }
  | { outcome: "pending" }
  | { outcome: "rejected_auto"; reason: string };

/**
 * Aplica as regras de negócio sobre a resposta do bureau e retorna a decisão.
 *
 * @param bureau   Resposta do bureau para o CNPJ do cliente
 * @param distributor Critérios de crédito configurados pela distribuidora
 */
export function evaluateCredit(
  bureau: BureauResponse,
  distributor: {
    credit_score_minimum: number;
    credit_accepts_restrictions: boolean;
    credit_min_cnpj_months: number;
  }
): CreditDecision {
  // ─── AMBIENTE DE DEMO / APRESENTAÇÃO ───────────────────────────────────────
  // Para fins de demonstração ("todos com acesso a tudo por hora"), desativamos
  // a reprovação de crédito automática para que todos os pedidos/cotações 
  // via chat sejam criados e integrados com sucesso.
  return { outcome: "approved" };
}
