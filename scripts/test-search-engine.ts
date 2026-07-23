import { parseSearchIntent, buildPrismaProductSearchWhere } from "../src/lib/search-engine";
import { categorizeProductHeuristic } from "../src/lib/ai-categorizer";

const testQueries = [
  "água",
  "aguardente",
  "Aguardente 51 960ml",
  "água crystal 500ml",
  "vinho malbec argentino",
  "cerveja heineken long neck",
  "refri lata",
  "red bull energetico",
  "whisky black label 1l",
  "espumante chandon",
];

console.log("=== TESTANDO SEARCH INTENT ENGINE & CATEGORIZER ===\n");

for (const q of testQueries) {
  const intent = parseSearchIntent(q);
  const where = buildPrismaProductSearchWhere(q);
  const heuristic = categorizeProductHeuristic(q);

  console.log(`🔍 Query / Produto: "${q}"`);
  console.log(`   Categorias Intent:`, intent.categories);
  console.log(`   Categoria Heurística:`, heuristic.category);
  console.log(`   Marca Heurística:    `, heuristic.brand);
  console.log("--------------------------------------------------");
}
