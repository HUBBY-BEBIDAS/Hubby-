/**
 * Utilitário de segurança e moderação para o chat.
 * Impede a troca de contatos pessoais (telefones, WhatsApp, e-mails, redes sociais)
 * protegendo o fluxo de negociação dentro da plataforma.
 */

export interface ChatGuardResult {
  isClean: boolean;
  reason?: string;
  matchedPattern?: string;
}

// Termos e palavras-chave de contato externo / redes sociais
const RESTRICTED_KEYWORDS = [
  "whatsapp",
  "whats",
  "wpp",
  "zap",
  "zappe",
  "zapp",
  "wasap",
  "wats",
  "wtsapp",
  "wts",
  "telefone",
  "fone",
  "celular",
  "cel",
  "instagram",
  "insta",
  "email",
  "e-mail",
  "gmail",
  "hotmail",
  "outlook",
  "chama no",
  "chamar no",
  "manda no",
  "passa o num",
  "passa o numero",
  "meu num",
  "meu numero",
  "meu fone",
  "meu zap",
  "meu wpp",
  "meu whats",
  "qual o seu num",
  "qual seu num",
  "qual o seu zap",
  "qual seu zap",
  "qual seu fone",
  "falar por fora",
  "negociar por fora",
  "contato direto",
  "chama la",
  "chama no privado",
  "inbox",
  "direct",
];

// Nomes de números por extenso em português
const NUMBER_WORDS = [
  "zero",
  "um",
  "dois",
  "tres",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

/**
 * Normaliza o texto removendo acentos e caracteres especiais desnecessários
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Valida a mensagem de chat para verificar se há tentativa de evasão de contato.
 */
export function validateChatMessage(text: string): ChatGuardResult {
  if (!text || typeof text !== "string") {
    return { isClean: true };
  }

  const normalized = normalizeText(text);

  // 1. Detecção de e-mails ou domínios / URLs
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  if (emailRegex.test(text)) {
    return {
      isClean: false,
      reason: "Envio de endereço de e-mail não é permitido no chat.",
      matchedPattern: "email",
    };
  }

  const urlRegex = /(https?:\/\/|www\.)[^\s]+/i;
  if (urlRegex.test(text)) {
    return {
      isClean: false,
      reason: "Envio de links externos não é permitido no chat.",
      matchedPattern: "url",
    };
  }

  // 2. Detecção de números de telefone em formato padrão (ex: (11) 99999-9999, 11999999999, 5511999999999)
  const phoneStandardRegex = /(\+?55\s*)?(\(?\d{2}\)?\s*)?(9?\d{4}[-\s]?\d{4})/g;
  const standardMatches = text.match(phoneStandardRegex);
  if (standardMatches) {
    // Filtra falsos positivos pequenos (ex: anos ou quantidades simples)
    for (const match of standardMatches) {
      const digitsOnly = match.replace(/\D/g, "");
      if (digitsOnly.length >= 8 && digitsOnly.length <= 13) {
        return {
          isClean: false,
          reason: "Envio de número de telefone não é permitido no chat.",
          matchedPattern: match,
        };
      }
    }
  }

  // 3. Detecção de sequências de números com pontuações ou espaços evasivos (ex: 9 9 8 7 6 . 5 4 3 2 ou 9-9-8-7-6-5-4-3-2)
  const digitsSpacedRegex = /(\d[\s.\-_,*#%/]{0,3}){7,}\d/g;
  const spacedMatches = text.match(digitsSpacedRegex);
  if (spacedMatches) {
    for (const match of spacedMatches) {
      const digitsOnly = match.replace(/\D/g, "");
      if (digitsOnly.length >= 8) {
        return {
          isClean: false,
          reason: "Sequência numérica suspeita de telefone detectada.",
          matchedPattern: match,
        };
      }
    }
  }

  // 4. Detecção de palavras-chave restritas (ex: whatsapp, zap, chama no, etc.)
  for (const keyword of RESTRICTED_KEYWORDS) {
    // Busca como palavra completa ou expressão isolada
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(normalized)) {
      return {
        isClean: false,
        reason: `Uso do termo restrito "${keyword}" não é permitido no chat.`,
        matchedPattern: keyword,
      };
    }
  }

  // 5. Detecção de números escritos por extenso em sequência (ex: "nove nove oito sete seis...")
  let numberWordCount = 0;
  const tokens = normalized.split(/\s+/);
  for (const token of tokens) {
    if (NUMBER_WORDS.includes(token)) {
      numberWordCount++;
      if (numberWordCount >= 4) {
        return {
          isClean: false,
          reason: "Números por extenso em sequência não são permitidos no chat.",
          matchedPattern: "numeros por extenso",
        };
      }
    }
  }

  return { isClean: true };
}

/**
 * Censura trechos da mensagem que violem a política de contatos (substituindo por [CONTEÚDO BLOQUEADO]).
 */
export function censorChatMessage(text: string): string {
  const validation = validateChatMessage(text);
  if (validation.isClean) return text;
  
  // Substitui telefones padrão
  let cleaned = text.replace(/(\+?55\s*)?(\(?\d{2}\)?\s*)?(9?\d{4}[-\s]?\d{4})/gi, "[TELEFONE BLOQUEADO]");
  
  // Substitui palavras chave
  for (const kw of RESTRICTED_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    cleaned = cleaned.replace(regex, "[TERMO BLOQUEADO]");
  }

  return cleaned;
}
