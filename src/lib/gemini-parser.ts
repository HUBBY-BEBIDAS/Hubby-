import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";

// Configura o provedor Google AI explicitamente usando a chave de API correta
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export const geminiProductImportSchema = z.object({
  produtos: z.array(
    z.object({
      row_number: z.number().int().describe("O número da linha original enviado na primeira coluna do CSV (ex: 2, 3, etc.)"),
      name: z.string().describe("Nome limpo e padronizado do produto (ex: 'Heineken Long Neck', 'Coca-Cola Zero')"),
      brand: z.string().describe("Marca específica do produto (ex: 'Heineken', 'Coca-Cola', 'Red Bull')"),
      price_brl: z.number().positive().describe("O preço decimal unitário ou do fardo em reais (ex: 15.90). NUNCA confunda com SKU, EAN ou códigos de produto (ex: 109230). Se o número for muito grande ou não tiver casas decimais típicas, provavelmente é um código, não um preço."),
      category: z.enum([
        "beer",
        "whisky",
        "vodka",
        "gin",
        "rum",
        "cachaca",
        "wine",
        "sparkling",
        "energy",
        "soft_drink",
        "water",
        "juice",
        "other"
      ]).describe("Categoria do produto baseada no tipo de bebida"),
      packaging_type: z.enum([
        "garrafa",
        "lata",
        "barril",
        "caixa",
        "fardo",
        "tetra_pak",
        "other"
      ]).describe("Tipo da embalagem identificada na descrição ou coluna"),
      packaging_volume_ml: z.number().int().positive().describe("Volume líquido de uma unidade em mililitros (ex: 350 para latas de 350ml, 1000 para garrafas de 1L)")
    })
  )
});

export type GeminiProductItem = z.infer<typeof geminiProductImportSchema>["produtos"][number];

/**
 * Envia o trecho da planilha em CSV ao Gemini 1.5 Flash para análise estruturada.
 */
export async function interpretarPlanilhaComGemini(dadosCsv: string): Promise<GeminiProductItem[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Variável de ambiente GEMINI_API_KEY não configurada");
  }

  const { object } = await generateObject({
    model: googleAI("gemini-3-flash-preview"),
    schema: geminiProductImportSchema,
    prompt: `
      Você é o motor de inteligência artificial da plataforma Hubby (SaaS B2B de bebidas).
      Sua tarefa é analisar o trecho de um arquivo CSV de uma planilha de produtos de uma distribuidora de bebidas.
      Identifique as informações dos produtos, seus preços e classifique-os segundo as regras do sistema.

      Estrutura das linhas de entrada no CSV:
      O CSV já foi pré-processado pelo backend e possui colunas fixas e padronizadas no cabeçalho (primeira linha):
      - 'RowNumber': O número da linha original da planilha Excel (ex: 2, 3, 4). Use este valor no campo row_number.
      - 'Name': O nome ou descrição do produto comercial (ex: "51 ICE BALADA LN 6 X 275 ML").
      - 'Price': O preço unitário de venda já limpo e normalizado (ex: 4.83 ou 73.19). Use este valor no campo price_brl.
      - Opcionalmente, pode conter colunas de Brand (Marca), Category (Categoria), Packaging (Embalagem) e Volume (Volume) se identificadas.

      Regras estritas de classificação:
      1. Ignore a linha de cabeçalho ('RowNumber,Name,Price...').
      2. Mapeie a categoria estritamente para um dos seguintes valores em inglês:
         - 'beer' (Cervejas, Chopp)
         - 'whisky' (Whisky, Bourbon)
         - 'vodka' (Vodkas)
         - 'gin' (Gins)
         - 'rum' (Rums)
         - 'cachaca' (Cachaças, aguardentes)
         - 'wine' (Vinhos tintos, brancos. IMPORTANTE: azeites NÃO são vinho - classifique como 'other' se não for bebida)
         - 'sparkling' (Champagne, Espumantes, Sidras)
         - 'energy' (Energéticos como Red Bull, Monster)
         - 'soft_drink' (Refrigerantes, Tônicas, Refrigerantes de guaraná)
         - 'water' (Águas minerais, com ou sem gás)
         - 'juice' (Sucos de frutas, néctares)
         - 'other' (Qualquer outra bebida ou produto que não se encaixe acima)
      3. Mapeie o tipo de embalagem (packaging_type) estritamente para um dos seguintes:
         - 'garrafa' (Garrafas de vidro ou plástico)
         - 'lata' (Latas de alumínio)
         - 'barril' (Barris, kegs, chopeiras de metal/plástico)
         - 'caixa' (Caixas de papelão/grade de garrafas)
         - 'fardo' (Packs de latas/garrafas envoltos em plástico)
         - 'tetra_pak' (Embalagem cartonada/caixa de suco)
         - 'other' (Outras embalagens)
      4. Extraia o volume unitário em ML (packaging_volume_ml) com precisão (ex: "Lata 350ml" -> 350, "Garrafa 1L" ou "1 Litro" -> 1000). Se for um fardo/caixa contendo latas/garrafas (ex: "Fardo Heineken 12 latas 350ml"), extraia o volume unitário da lata (350).
      5. Preencha 'price_brl' com o valor numérico exato presente na coluna 'Price'. NUNCA confunda o preço com o número da linha ('RowNumber') ou códigos/SKUs (que foram filtrados e não estão no CSV).
      6. Retorne apenas produtos válidos que possuem preços associados.

      Dados do CSV para classificar:
      ---
      ${dadosCsv}
      ---
    `
  });

  return object.produtos;
}

export const geminiLayoutSchema = z.object({
  header_row: z.number().int().describe("O número da linha que contém o cabeçalho com os nomes das colunas (ex: 5)"),
  product_name_column: z.string().describe("A letra da coluna que contém o nome/descrição dos produtos (ex: 'B')"),
  price_column: z.string().describe("A letra da coluna que contém o preço regular/por hora de venda dos produtos (ex: 'G'). NUNCA selecione colunas de preço mínimo, com desconto (ex: 'VALOR C/ DESC.'), EAN, SKU ou códigos."),
  brand_column: z.string().optional().describe("A letra da coluna que contém a marca do produto, se houver uma coluna exclusiva de marcas (ex: 'C'). Se não houver, deixe em branco.")
});

export type GeminiLayoutInfo = z.infer<typeof geminiLayoutSchema>;

/**
 * Envia as primeiras 20 linhas estruturadas ao Gemini para identificar o layout da planilha.
 */
export async function detectarLayoutComGemini(estruturaPlanilha: string): Promise<GeminiLayoutInfo> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Variável de ambiente GEMINI_API_KEY não configurada");
  }

  const { object } = await generateObject({
    model: googleAI("gemini-3-flash-preview"),
    schema: geminiLayoutSchema,
    prompt: `
      Você é o motor de inteligência artificial da plataforma Hubby (SaaS B2B de bebidas).
      Sua tarefa é analisar a estrutura das primeiras 20 linhas de uma planilha Excel de uma distribuidora de bebidas e identificar o layout.

      Você deve determinar:
      1. Qual linha contém os cabeçalhos/títulos das colunas (ex: 'CÓDIGO', 'PRODUTO', 'VALOR').
      2. Qual coluna (letra da coluna do Excel, ex: 'B') contém o nome/descrição dos produtos.
      3. Qual coluna (letra, ex: 'G') contém o preço regular (normal) por hora do produto.
         - ATENÇÃO: Ignore colunas de código (SKU, EAN, CÓDIGO). Elas não representam preços.
         - ATENÇÃO: Ignore colunas de preço com desconto ou preço mínimo (ex: 'VALOR C/ DESC.', 'PREÇO MIN', 'MINIMO'). Queremos apenas o PREÇO REGULAR (normal/valor cheio).
      4. Qual coluna (letra, ex: 'C') contém a marca do produto (se houver uma coluna exclusiva para isso, ex: 'MARCA'). Se as marcas estiverem misturadas no nome do produto, ignore.

      Aqui está o snippet das primeiras 20 linhas da planilha:
      ---
      ${estruturaPlanilha}
      ---
    `
  });

  return object;
}
