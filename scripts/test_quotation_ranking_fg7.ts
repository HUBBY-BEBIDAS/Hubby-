import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Busca uma cotação em Santo André ou São Caetano do Sul ou São Paulo
  const quotation = await prisma.quotation.findFirst({
    where: {
      delivery_state: "SP",
    },
    include: {
      items: true,
      client: true,
    },
    orderBy: { created_at: "desc" },
  });

  if (!quotation) {
    console.log("Nenhuma cotação encontrada");
    return;
  }

  console.log(`Cotação encontrada: ${quotation.id} | Cidade: ${quotation.delivery_city}, ${quotation.delivery_state}`);

  // Verifica slots ativos para a cidade
  const activeSlots = await prisma.sponsoredSlot.findMany({
    where: {
      region_city: { equals: quotation.delivery_city, mode: "insensitive" },
      region_state: { equals: quotation.delivery_state, mode: "insensitive" },
      active: true,
    },
    include: {
      distributor: { select: { company_name: true } },
    },
  });

  console.log("SLOTS ATIVOS NA REGIÃO:", JSON.stringify(activeSlots, null, 2));
}

main().finally(() => prisma.$disconnect());
