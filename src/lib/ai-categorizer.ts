import { ProductCategory, PackagingType } from "@prisma/client";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { normalizeText, parseSearchIntent } from "./search-engine";

export type AIProductCategorizationResult = {
  category: ProductCategory;
  brand: string;
  packaging_type: PackagingType;
  packaging_volume_ml: number;
};

/**
 * Regras heurísticas de fallback (rápidas e sem custo de rede)
 */
export function categorizeProductHeuristic(productName: string): AIProductCategorizationResult {
  const norm = normalizeText(productName);
  const intent = parseSearchIntent(productName);

  let category: ProductCategory = ProductCategory.other;
  if (intent.categories.length > 0) {
    category = intent.categories[0];
  } else if (/\b(cachaca|pinga|aguardente)\b/.test(norm)) {
    category = ProductCategory.cachaca;
  } else if (/\b(agua|aguas|mineral|h2o|h2oh)\b/.test(norm)) {
    category = ProductCategory.water;
  } else if (/\b(cerveja|cervejas|breja|pilsen|lager|ipa|chopp|chope)\b/.test(norm)) {
    category = ProductCategory.beer;
  } else if (/\b(vinho|vinhos|tinto|cabernet|malbec|merlot)\b/.test(norm)) {
    category = ProductCategory.wine;
  } else if (/\b(espumante|espumantes|prosecco|champagne|chandon)\b/.test(norm)) {
    category = ProductCategory.sparkling;
  } else if (/\b(refrigerante|refrigerantes|refri|coca|guarana|soda|fanta)\b/.test(norm)) {
    category = ProductCategory.soft_drink;
  } else if (/\b(energetico|energeticos|red bull|redbull|monster)\b/.test(norm)) {
    category = ProductCategory.energy;
  } else if (/\b(suco|sucos|nectar|polpa)\b/.test(norm)) {
    category = ProductCategory.juice;
  } else if (/\b(whisky|whiskies|wisky|bourbon)\b/.test(norm)) {
    category = ProductCategory.whisky;
  } else if (/\b(vodka|vodkas)\b/.test(norm)) {
    category = ProductCategory.vodka;
  } else if (/\b(gin|gins)\b/.test(norm)) {
    category = ProductCategory.gin;
  } else if (/\b(rum|rums)\b/.test(norm)) {
    category = ProductCategory.rum;
  }

  // Marca
  let brand = "Genérica";
  if (intent.brands.length > 0) {
    brand = intent.brands[0];
  } else {
    // Tenta pegar a primeira palavra como marca
    const words = productName.trim().split(/\s+/);
    if (words[0] && words[0].length >= 3) {
      brand = words[0];
    }
  }

  // Tipo de embalagem
  let packaging_type: PackagingType = PackagingType.lata;
  if (norm.includes("garrafa") || norm.includes("gfa") || norm.includes("ln") || norm.includes("long neck") || norm.includes("600ml") || norm.includes("1l") || norm.includes("750ml") || norm.includes("pet") || norm.includes("2l")) {
    packaging_type = PackagingType.garrafa;
  } else if (norm.includes("keg") || norm.includes("barril")) {
    packaging_type = PackagingType.barril;
  } else if (norm.includes("tetra") || norm.includes("caixa") || norm.includes("tpb")) {
    packaging_type = PackagingType.tetra_pak;
  }

  // Volume em ML (busca padrões como 350ml, 500ml, 1l, 2l, 750ml)
  let packaging_volume_ml = 350;
  const matchMl = norm.match(/(\d+)\s*ml/);
  const matchL = norm.match(/(\d+(?:[.,]\d+)?)\s*l\b/);

  if (matchMl) {
    packaging_volume_ml = parseInt(matchMl[1]);
  } else if (matchL) {
    const val = parseFloat(matchL[1].replace(",", "."));
    packaging_volume_ml = Math.round(val * 1000);
  }

  return {
    category,
    brand,
    packaging_type,
    packaging_volume_ml,
  };
}

/**
 * Classifica um produto utilizando a IA do Google Gemini (com fallback automático para regras estáticas)
 */
export async function categorizeProductWithAI(
  productName: string
): Promise<AIProductCategorizationResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Se não houver chave de API configurada, utiliza a IA por heurística
    return categorizeProductHeuristic(productName);
  }

  try {
    const prompt = `Analise o nome do produto de bebida abaixo e retorne APENAS um JSON válido no formato:
{
  "category": "beer" | "whisky" | "vodka" | "gin" | "rum" | "cachaca" | "wine" | "sparkling" | "energy" | "soft_drink" | "water" | "juice" | "other",
  "brand": "Nome da Marca",
  "packaging_type": "garrafa" | "lata" | "barril" | "caixa" | "fardo" | "tetra_pak" | "other",
  "packaging_volume_ml": número em ML (ex: 350, 500, 750, 1000, 2000)
}

Nome do Produto: "${productName}"`;

    const response = await generateText({
      model: google("gemini-1.5-flash"),
      prompt,
    });

    const cleanText = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanText);

    return {
      category: parsed.category ?? ProductCategory.other,
      brand: parsed.brand ?? "Genérica",
      packaging_type: parsed.packaging_type ?? PackagingType.lata,
      packaging_volume_ml: typeof parsed.packaging_volume_ml === "number" ? parsed.packaging_volume_ml : 350,
    };
  } catch (err) {
    console.warn(`[AI Categorizer] Fallback para heurística no produto "${productName}":`, err);
    return categorizeProductHeuristic(productName);
  }
}
