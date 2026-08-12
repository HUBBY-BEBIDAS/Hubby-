import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "fg7@gmail.com" },
    include: {
      distributor: true,
    },
  });

  if (!user?.distributor) {
    console.error("Distribuidora fg7 não encontrada");
    return;
  }

  const dist = user.distributor;

  // Remove slots antigos
  await prisma.sponsoredSlot.deleteMany({
    where: { distributor_id: dist.id },
  });

  const now = new Date();
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 30);

  // Ativa patrocínio máximo (top_ranking) para as principais regiões (Santo André, São Caetano do Sul, São Paulo)
  const targetCities = ["Santo André", "São Caetano do Sul", "São Paulo"];

  for (const city of targetCities) {
    const slot = await prisma.sponsoredSlot.create({
      data: {
        distributor_id: dist.id,
        slot_type: "top_ranking",
        region_city: city,
        region_state: "SP",
        starts_at: now,
        ends_at: endsAt,
        budget_cents: 29900,
        active: true, // SIMULADO E CONFIRMADO COMO PAGO E ATIVO
      },
    });
    console.log(`PATROCÍNIO MÁXIMO ATIVADO PARA FG7 EM ${city}, SP:`, slot.id);
  }
}

main().finally(() => prisma.$disconnect());
