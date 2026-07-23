import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { categorizeProductHeuristic } from "../src/lib/ai-categorizer";
import { ProductCategory } from "@prisma/client";

async function fixCategories() {
  console.log("=== CORRIGINDO CATEGORIAS INCORRETAS NO BANCO DE DADOS ===");

  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
    },
  });

  let fixedCount = 0;

  for (const p of allProducts) {
    const fullName = `${p.brand} ${p.name}`;
    const correctResult = categorizeProductHeuristic(fullName);

    if (correctResult.category !== ProductCategory.other && correctResult.category !== p.category) {
      console.log(
        `🔄 Atualizando Produto: "${p.brand} - ${p.name}" | De: ${p.category} -> Para: ${correctResult.category}`
      );
      await prisma.product.update({
        where: { id: p.id },
        data: {
          category: correctResult.category,
        },
      });
      fixedCount++;
    }
  }

  // Também verifica ProductCatalog se existir
  const allCatalog = await prisma.productCatalog.findMany({
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
    },
  });

  let fixedCatalogCount = 0;
  for (const c of allCatalog) {
    const fullName = `${c.brand} ${c.name}`;
    const correctResult = categorizeProductHeuristic(fullName);

    if (correctResult.category !== ProductCategory.other && correctResult.category !== c.category) {
      console.log(
        `🔄 Atualizando Catálogo Central: "${c.brand} - ${c.name}" | De: ${c.category} -> Para: ${correctResult.category}`
      );
      await prisma.productCatalog.update({
        where: { id: c.id },
        data: {
          category: correctResult.category,
        },
      });
      fixedCatalogCount++;
    }
  }

  console.log(
    `\n✅ Concluído! Produtos corrigidos: ${fixedCount} | Itens de catálogo corrigidos: ${fixedCatalogCount}`
  );
}

fixCategories()
  .catch((err) => console.error("Erro ao recategorizar banco:", err))
  .finally(() => prisma.$disconnect());
