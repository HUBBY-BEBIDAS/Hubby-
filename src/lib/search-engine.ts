import { ProductCategory } from "@prisma/client";

export type SearchIntent = {
  categories: ProductCategory[];
  brands: string[];
  keywords: string[];
  normalizedQuery: string;
};

/**
 * Normaliza o texto removendo acentos, convertendo para minúsculas e limpando espaços extras.
 * Exemplo: "Água Mineral C/ Gás" -> "agua mineral c/ gas"
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Dicionário de Mapeamento de Sinônimos/Termos em Português para Categorias do Prisma
 */
const CATEGORY_SYNONYMS: Record<string, ProductCategory[]> = {
  // Águas
  agua: [ProductCategory.water],
  aguas: [ProductCategory.water],
  mineral: [ProductCategory.water],
  h2o: [ProductCategory.water],
  h2oh: [ProductCategory.water],

  // Cervejas
  cerveja: [ProductCategory.beer],
  cervejas: [ProductCategory.beer],
  breja: [ProductCategory.beer],
  brejas: [ProductCategory.beer],
  chopp: [ProductCategory.beer],
  chope: [ProductCategory.beer],
  pilsen: [ProductCategory.beer],
  lager: [ProductCategory.beer],
  ipa: [ProductCategory.beer],
  malzbier: [ProductCategory.beer],
  "puro malte": [ProductCategory.beer],

  // Vinhos
  vinho: [ProductCategory.wine],
  vinhos: [ProductCategory.wine],
  tinto: [ProductCategory.wine],
  brancowine: [ProductCategory.wine],
  rose: [ProductCategory.wine],
  cabernet: [ProductCategory.wine],
  malbec: [ProductCategory.wine],
  merlot: [ProductCategory.wine],
  carmenere: [ProductCategory.wine],
  chardonnay: [ProductCategory.wine],
  sauvignon: [ProductCategory.wine],
  syrah: [ProductCategory.wine],
  shiraz: [ProductCategory.wine],

  // Espumantes / Champagnes
  espumante: [ProductCategory.sparkling],
  espumantes: [ProductCategory.sparkling],
  prosecco: [ProductCategory.sparkling],
  champagne: [ProductCategory.sparkling],
  champanhe: [ProductCategory.sparkling],
  cava: [ProductCategory.sparkling],
  moscatel: [ProductCategory.sparkling],

  // Refrigerantes
  refrigerante: [ProductCategory.soft_drink],
  refrigerantes: [ProductCategory.soft_drink],
  refri: [ProductCategory.soft_drink],
  refris: [ProductCategory.soft_drink],
  soda: [ProductCategory.soft_drink],
  cola: [ProductCategory.soft_drink],
  guarana: [ProductCategory.soft_drink],

  // Energéticos
  energetico: [ProductCategory.energy],
  energeticos: [ProductCategory.energy],
  energy: [ProductCategory.energy],

  // Sucos
  suco: [ProductCategory.juice],
  sucos: [ProductCategory.juice],
  nektar: [ProductCategory.juice],
  nectar: [ProductCategory.juice],
  polpa: [ProductCategory.juice],

  // Destilados genérico
  destilado: [
    ProductCategory.whisky,
    ProductCategory.vodka,
    ProductCategory.gin,
    ProductCategory.rum,
    ProductCategory.cachaca,
  ],
  destilados: [
    ProductCategory.whisky,
    ProductCategory.vodka,
    ProductCategory.gin,
    ProductCategory.rum,
    ProductCategory.cachaca,
  ],

  // Whisky / Wisky / Uisque
  whisky: [ProductCategory.whisky],
  whiskies: [ProductCategory.whisky],
  wisky: [ProductCategory.whisky],
  uisque: [ProductCategory.whisky],
  bourbon: [ProductCategory.whisky],
  scotch: [ProductCategory.whisky],

  // Vodka
  vodka: [ProductCategory.vodka],
  vodkas: [ProductCategory.vodka],
  wodka: [ProductCategory.vodka],

  // Gin
  gin: [ProductCategory.gin],
  gins: [ProductCategory.gin],

  // Rum
  rum: [ProductCategory.rum],
  rums: [ProductCategory.rum],

  // Cachaça / Pinga
  cachaca: [ProductCategory.cachaca],
  cachacas: [ProductCategory.cachaca],
  pinga: [ProductCategory.cachaca],
  aguardente: [ProductCategory.cachaca],
};

/**
 * Dicionário de Mapeamento de Marcas conhecidas (termo normalizado -> Nome oficial da marca)
 */
const BRAND_SYNONYMS: Record<string, string> = {
  // Águas
  crystal: "Crystal",
  bonafont: "Bonafont",
  minalba: "Minalba",
  lindoya: "Lindoya",
  nestle: "Nestlé Pureza Vital",
  ibira: "Ibirá",
  indaiatuba: "Indaiá",
  perrier: "Perrier",
  "san pellegrino": "San Pellegrino",

  // Cervejas
  heineken: "Heineken",
  amstel: "Amstel",
  skol: "Skol",
  brahma: "Brahma",
  budweiser: "Budweiser",
  bud: "Budweiser",
  stella: "Stella Artois",
  "stella artois": "Stella Artois",
  corona: "Corona",
  eisenbahn: "Eisenbahn",
  spaten: "Spaten",
  beck: "Beck's",
  becks: "Beck's",
  becker: "Beck's",
  itaipava: "Itaipava",
  bohemia: "Bohemia",
  antarctica: "Antarctica",
  original: "Antarctica Original",
  colorado: "Colorado",
  devassa: "Devassa",
  "baden baden": "Baden Baden",
  "blue moon": "Blue Moon",

  // Destilados & Whiskies
  "red bull": "Red Bull",
  redbull: "Red Bull",
  monster: "Monster",
  "black label": "Johnnie Walker",
  "red label": "Johnnie Walker",
  "johnnie walker": "Johnnie Walker",
  chivas: "Chivas Regal",
  "jack daniels": "Jack Daniel's",
  jackdaniels: "Jack Daniel's",
  jack: "Jack Daniel's",
  ballantines: "Ballantine's",
  jameson: "Jameson",
  absolut: "Absolut",
  smirnoff: "Smirnoff",
  "grey goose": "Grey Goose",
  tanqueray: "Tanqueray",
  beefeater: "Beefeater",
  gordons: "Gordon's",
  bombay: "Bombay Sapphire",
  bacardi: "Bacardi",
  "51": "Cachaça 51",
  pitu: "Pitú",
  "velho barreiro": "Velho Barreiro",
  ypioca: "Ypióca",

  // Vinhos & Espumantes
  chandon: "Chandon",
  miolo: "Miolo",
  salton: "Salton",
  perini: "Perini",
  mumm: "Mumm",
  casillero: "Casillero del Diablo",
  "concha y toro": "Concha y Toro",
  "santa carolina": "Santa Carolina",
  santarita: "Santa Rita",
  reservado: "Concha y Toro Reservado",

  // Refrigerantes & Sucos
  coca: "Coca-Cola",
  cocacola: "Coca-Cola",
  "coca cola": "Coca-Cola",
  pepsi: "Pepsi",
  fanta: "Fanta",
  sprite: "Sprite",
  schweppes: "Schweppes",
  "del valle": "Del Valle",
  delvalle: "Del Valle",
  maguary: "Maguary",
  prats: "Prats",
  aurora: "Aurora",
};

/**
 * Mapeamento de Marca Oficial -> Categoria Padrão
 */
export const BRAND_CATEGORY_MAP: Record<string, ProductCategory> = {
  "Heineken": ProductCategory.beer,
  "Amstel": ProductCategory.beer,
  "Skol": ProductCategory.beer,
  "Brahma": ProductCategory.beer,
  "Budweiser": ProductCategory.beer,
  "Stella Artois": ProductCategory.beer,
  "Corona": ProductCategory.beer,
  "Eisenbahn": ProductCategory.beer,
  "Spaten": ProductCategory.beer,
  "Beck's": ProductCategory.beer,
  "Itaipava": ProductCategory.beer,
  "Bohemia": ProductCategory.beer,
  "Antarctica": ProductCategory.beer,
  "Antarctica Original": ProductCategory.beer,
  "Colorado": ProductCategory.beer,
  "Devassa": ProductCategory.beer,
  "Baden Baden": ProductCategory.beer,
  "Blue Moon": ProductCategory.beer,

  "Crystal": ProductCategory.water,
  "Bonafont": ProductCategory.water,
  "Minalba": ProductCategory.water,
  "Lindoya": ProductCategory.water,
  "Nestlé Pureza Vital": ProductCategory.water,
  "Ibirá": ProductCategory.water,
  "Indaiá": ProductCategory.water,
  "Perrier": ProductCategory.water,
  "San Pellegrino": ProductCategory.water,

  "Pitú": ProductCategory.cachaca,
  "Cachaça 51": ProductCategory.cachaca,
  "Velho Barreiro": ProductCategory.cachaca,
  "Ypióca": ProductCategory.cachaca,

  "Johnnie Walker": ProductCategory.whisky,
  "Chivas Regal": ProductCategory.whisky,
  "Jack Daniel's": ProductCategory.whisky,
  "Ballantine's": ProductCategory.whisky,
  "Jameson": ProductCategory.whisky,

  "Absolut": ProductCategory.vodka,
  "Smirnoff": ProductCategory.vodka,
  "Grey Goose": ProductCategory.vodka,

  "Tanqueray": ProductCategory.gin,
  "Beefeater": ProductCategory.gin,
  "Gordon's": ProductCategory.gin,
  "Bombay Sapphire": ProductCategory.gin,

  "Bacardi": ProductCategory.rum,

  "Chandon": ProductCategory.sparkling,
  "Mumm": ProductCategory.sparkling,
  "Miolo": ProductCategory.wine,
  "Salton": ProductCategory.wine,
  "Perini": ProductCategory.wine,
  "Casillero del Diablo": ProductCategory.wine,
  "Concha y Toro": ProductCategory.wine,
  "Santa Carolina": ProductCategory.wine,
  "Santa Rita": ProductCategory.wine,
  "Concha y Toro Reservado": ProductCategory.wine,

  "Red Bull": ProductCategory.energy,
  "Monster": ProductCategory.energy,

  "Coca-Cola": ProductCategory.soft_drink,
  "Pepsi": ProductCategory.soft_drink,
  "Fanta": ProductCategory.soft_drink,
  "Sprite": ProductCategory.soft_drink,
  "Schweppes": ProductCategory.soft_drink,

  "Del Valle": ProductCategory.juice,
  "Maguary": ProductCategory.juice,
  "Prats": ProductCategory.juice,
  "Aurora": ProductCategory.juice,
};

/**
 * Analisa a string de busca e extrai intenções (Categorias, Marcas e Palavras-chave)
 */
export function parseSearchIntent(query: string): SearchIntent {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { categories: [], brands: [], keywords: [], normalizedQuery: "" };
  }

  const categoriesSet = new Set<ProductCategory>();
  const brandsSet = new Set<string>();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  // 1. Verifica busca por termos compostos em Marcas e Categorias
  const queryLower = normalizedQuery;

  // Checa marcas de múltiplos termos (ex: "red bull", "coca cola", "stella artois", "jack daniels")
  for (const [key, brandName] of Object.entries(BRAND_SYNONYMS)) {
    if (key.includes(" ") && queryLower.includes(key)) {
      brandsSet.add(brandName);
    }
  }

  // Checa marcas por token único
  for (const token of tokens) {
    if (BRAND_SYNONYMS[token]) {
      brandsSet.add(BRAND_SYNONYMS[token]);
    }
  }

  // 1. Checa categorias explícitas por token único e pares
  for (let i = 0; i < tokens.length; i++) {
    const singleToken = tokens[i];
    if (CATEGORY_SYNONYMS[singleToken]) {
      CATEGORY_SYNONYMS[singleToken].forEach((cat) => categoriesSet.add(cat));
    }
    if (i < tokens.length - 1) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      if (CATEGORY_SYNONYMS[pair]) {
        CATEGORY_SYNONYMS[pair].forEach((cat) => categoriesSet.add(cat));
      }
    }
  }

  // 2. Se nenhuma categoria explícita foi informada, infere através da marca detectada
  if (categoriesSet.size === 0) {
    for (const b of Array.from(brandsSet)) {
      if (BRAND_CATEGORY_MAP[b]) {
        categoriesSet.add(BRAND_CATEGORY_MAP[b]);
      }
    }
  }

  // Palavras-chave genéricas que não viraram categoria ou marca
  const keywords = tokens.filter((t) => {
    if (CATEGORY_SYNONYMS[t]) return false;
    if (BRAND_SYNONYMS[t]) return false;
    return true;
  });

  return {
    categories: Array.from(categoriesSet),
    brands: Array.from(brandsSet),
    keywords,
    normalizedQuery,
  };
}

/**
 * Constrói um objeto de filtro Prisma `where` flexível baseado na intenção de busca.
 */
export function buildPrismaProductSearchWhere(query: string) {
  const intent = parseSearchIntent(query);
  if (!intent.normalizedQuery) {
    return {};
  }

  const orConditions: any[] = [];

  // Se identificou categorias (ex: "água", "vinhos", "cerveja")
  if (intent.categories.length > 0) {
    orConditions.push({
      category: { in: intent.categories },
    });
  }

  // Se identificou marcas (ex: "crystal", "heineken", "red bull")
  if (intent.brands.length > 0) {
    intent.brands.forEach((brand) => {
      orConditions.push({
        brand: { equals: brand, mode: "insensitive" },
      });
      orConditions.push({
        brand: { contains: brand, mode: "insensitive" },
      });
    });
  }

  // Busca genérica por substring no nome ou na marca com o termo completo original
  orConditions.push(
    { name: { contains: intent.normalizedQuery, mode: "insensitive" } },
    { brand: { contains: intent.normalizedQuery, mode: "insensitive" } }
  );

  // Busca por tokens individuais de palavras-chave se houverem
  if (intent.keywords.length > 0) {
    intent.keywords.forEach((kw) => {
      if (kw.length >= 2) {
        orConditions.push(
          { name: { contains: kw, mode: "insensitive" } },
          { brand: { contains: kw, mode: "insensitive" } }
        );
      }
    });
  }

  return {
    OR: orConditions,
  };
}
