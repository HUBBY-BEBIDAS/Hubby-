import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = "arenavip@gmail.com";

  console.log(`Buscando usuário ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { distributor: true },
  });

  if (!user || !user.distributor) {
    throw new Error(`Distribuidora com email ${email} não encontrada!`);
  }

  const distId = user.distributor.id;
  console.log(`Usuário encontrado: ${user.id}, Distribuidora: ${distId}`);

  // 1. Atualiza Usuário: email verificado
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      email_verified: true,
      email_verified_at: new Date(),
    },
  });
  console.log("Usuário verificado com sucesso.");

  // 2. Atualiza Distribuidora para o plano ENTERPRISE ativo (máximo nível)
  const updatedDist = await prisma.distributor.update({
    where: { id: distId },
    data: {
      plan: "enterprise",
      plan_status: "active",
      plan_period: "annual",
      approved_by_admin: true,
      onboarding_completed: true,
      onboarding_status: "CONCLUIDO",
      onboarding_step: 5,
      average_rating: 5.0,
      review_count: 42,
      cnpj_status: "ATIVA",
      cnpj_verified_at: new Date(),
      erp_api_key: "hubby_erpkey_arenavip_enterprise_master",
      webhook_url: "https://webhook.site/arenavip-hubby-test",
      webhook_secret: "arenavip_secret_webhook_enterprise",
      webhook_enabled: true,
      credit_score_minimum: 0,
      credit_accepts_restrictions: true,
    },
  });
  console.log("Distribuidora atualizada para plano ENTERPRISE ATIVO com sucesso.");

  // 3. Ativar patrocínio VIP máximo (Sponsored Slots: top_ranking, category_highlight, search_boost)
  await prisma.sponsoredSlot.deleteMany({
    where: { distributor_id: distId },
  });

  const now = new Date();
  const endsAt = new Date();
  endsAt.setFullYear(endsAt.getFullYear() + 1); // 1 ano de acesso VIP total

  const targetCities = [
    { city: "Santo André", state: "SP" },
    { city: "São Bernardo do Campo", state: "SP" },
    { city: "São Caetano do Sul", state: "SP" },
    { city: "São Paulo", state: "SP" },
  ];

  for (const { city, state } of targetCities) {
    await prisma.sponsoredSlot.create({
      data: {
        distributor_id: distId,
        slot_type: "top_ranking",
        region_city: city,
        region_state: state,
        starts_at: now,
        ends_at: endsAt,
        budget_cents: 100000,
        active: true,
      },
    });

    await prisma.sponsoredSlot.create({
      data: {
        distributor_id: distId,
        slot_type: "search_boost",
        region_city: city,
        region_state: state,
        starts_at: now,
        ends_at: endsAt,
        budget_cents: 50000,
        active: true,
      },
    });
  }
  console.log("Slots de Patrocínio VIP (Top Ranking e Search Boost) ativados por 1 ano.");

  // 4. Configurar alguns produtos de exemplo para testar a Gestão de Vencimentos (exclusivo Enterprise)
  const products = await prisma.product.findMany({
    where: { distributor_id: distId },
    take: 4,
  });

  if (products.length >= 3) {
    const d1 = new Date();
    d1.setDate(d1.getDate() + 12); // vence em 12 dias (atenção / urgente)
    await prisma.product.update({
      where: { id: products[0].id },
      data: {
        expiry_date: d1,
        expiry_alert_days: 30,
        expiry_discount_pct: 25,
        is_near_expiry: true,
      },
    });

    const d2 = new Date();
    d2.setDate(d2.getDate() + 25); // vence em 25 dias
    await prisma.product.update({
      where: { id: products[1].id },
      data: {
        expiry_date: d2,
        expiry_alert_days: 30,
        expiry_discount_pct: 15,
        is_near_expiry: true,
      },
    });

    const d3 = new Date();
    d3.setDate(d3.getDate() + 90); // lote normal
    await prisma.product.update({
      where: { id: products[2].id },
      data: {
        expiry_date: d3,
        expiry_alert_days: 30,
        expiry_discount_pct: null,
        is_near_expiry: false,
      },
    });

    console.log("Produtos de exemplo configurados para teste da Gestão de Vencimentos.");
  }

  // 5. Verificar estado final
  const finalCheck = await prisma.distributor.findUnique({
    where: { id: distId },
    include: {
      user: {
        select: { email: true, role: true, email_verified: true },
      },
      sponsored_slots: {
        where: { active: true },
        select: { slot_type: true, region_city: true, active: true },
      },
    },
  });

  console.log("\n====== RESULTADO FINAL ======");
  console.log(JSON.stringify(finalCheck, null, 2));
}

main()
  .catch((e) => {
    console.error("Erro ao aplicar upgrade:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
