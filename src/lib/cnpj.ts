/**
 * Validação de CNPJ: formato + dígitos verificadores + consulta à Receita Federal
 * via BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/{cnpj})
 */

/** Remove tudo que não for dígito */
export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/** Formata um CNPJ limpo: 00.000.000/0000-00 */
export function formatCnpj(cnpj: string): string {
  const c = cleanCnpj(cnpj);
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** Valida formato e dígitos verificadores (sem consulta externa) */
export function validateCnpjFormat(cnpj: string): boolean {
  const c = cleanCnpj(cnpj);
  if (c.length !== 14) return false;
  // Rejeita sequências repetidas (00000000000000, 11111111111111, …)
  if (/^(\d)\1{13}$/.test(c)) return false;

  const calcDigit = (digits: string, weights: number[]): number => {
    const sum = digits
      .split("")
      .reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  if (Number(c[12]) !== calcDigit(c.slice(0, 12), w1)) return false;
  if (Number(c[13]) !== calcDigit(c.slice(0, 13), w2)) return false;

  return true;
}

// ─── Tipos retornados pela BrasilAPI ────────────────────────────────────────

export type CnpjSituacao =
  | "ATIVA"
  | "INAPTA"
  | "SUSPENSA"
  | "BAIXADA"
  | "NULA"
  | string;

export type CnpjReceitaData = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: CnpjSituacao;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  email: string | null;
  ddd_telefone_1: string | null;
  data_inicio_atividade: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
};

export type CnpjValidationResult =
  | { valid: true; data: CnpjReceitaData }
  | { valid: false; reason: "invalid_format" | "not_found" | "api_error" | "inactive"; message: string };

/**
 * Consulta o CNPJ na Receita Federal via BrasilAPI.
 * Inclui validação local de formato antes de fazer a chamada.
 */
export async function validateCnpjReceita(
  cnpj: string
): Promise<CnpjValidationResult> {
  const cleaned = cleanCnpj(cnpj);

  if (!validateCnpjFormat(cleaned)) {
    return {
      valid: false,
      reason: "invalid_format",
      message: "CNPJ inválido — verifique os dígitos verificadores",
    };
  }

  let data: CnpjReceitaData;
  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleaned}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000), // 8s timeout
        cache: "no-store", // nunca cachear dados da Receita
      }
    );

    if (response.status === 404) {
      return {
        valid: false,
        reason: "not_found",
        message: "CNPJ não encontrado na Receita Federal",
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        reason: "api_error",
        message: "Não foi possível consultar a Receita Federal. Tente novamente em instantes.",
      };
    }

    data = await response.json() as CnpjReceitaData;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      valid: false,
      reason: "api_error",
      message: isTimeout
        ? "Consulta à Receita Federal excedeu o tempo limite. Tente novamente."
        : "Erro ao consultar a Receita Federal.",
    };
  }

  // CNPJs inativos não podem se cadastrar
  if (data.situacao_cadastral !== "ATIVA") {
    return {
      valid: false,
      reason: "inactive",
      message: `CNPJ com situação "${data.descricao_situacao_cadastral ?? data.situacao_cadastral}" na Receita Federal. Apenas empresas ativas podem se cadastrar.`,
    };
  }

  return { valid: true, data };
}
