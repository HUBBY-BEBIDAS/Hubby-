// @ts-nocheck
/**
 * prisma/seed.ts
 *
 * Popula o banco com dados de teste realistas para desenvolvimento local.
 * Idempotente: apaga os registros do seed antes de recriar.
 *
 * Executar:  npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

// ─── Emails fixos para identificar e limpar dados do seed ─────────────────────

const SEED_EMAILS = ["alpha@teste.com", "beta@teste.com", "gamma@teste.com"];

// ─── Produtos (nome, marca, categoria, embalagem, volume) ─────────────────────

type ProductTemplate = {
  name: string;
  brand: string;
  category: "beer" | "whisky" | "vodka" | "gin" | "rum" | "cachaca" | "wine" | "sparkling" | "energy" | "soft_drink" | "water" | "juice" | "other";
  packaging_type: "garrafa" | "lata" | "barril" | "caixa" | "fardo" | "tetra_pak" | "other";
  packaging_volume_ml: number;
  prices: { alpha: number; beta: number; gamma: number };
};

const PRODUCTS: ProductTemplate[] = [
  { name: "Heineken Long Neck",    brand: "Heineken", category: "beer",   packaging_type: "garrafa", packaging_volume_ml: 330,  prices: { alpha:  490, beta:  470, gamma:  510 } },
  { name: "Heineken",              brand: "Heineken", category: "beer",   packaging_type: "lata",    packaging_volume_ml: 350,  prices: { alpha:  420, beta:  400, gamma:  450 } },
  { name: "Heineken",              brand: "Heineken", category: "beer",   packaging_type: "garrafa", packaging_volume_ml: 600,  prices: { alpha:  850, beta:  820, gamma:  890 } },
  { name: "Brahma",                brand: "Brahma",   category: "beer",   packaging_type: "lata",    packaging_volume_ml: 350,  prices: { alpha:  320, beta:  300, gamma:  340 } },
  { name: "Brahma",                brand: "Brahma",   category: "beer",   packaging_type: "garrafa", packaging_volume_ml: 600,  prices: { alpha:  650, beta:  620, gamma:  680 } },
  { name: "Skol",                  brand: "Skol",     category: "beer",   packaging_type: "lata",    packaging_volume_ml: 350,  prices: { alpha:  290, beta:  270, gamma:  310 } },
  { name: "Budweiser Long Neck",   brand: "Budweiser",category: "beer",   packaging_type: "garrafa", packaging_volume_ml: 330,  prices: { alpha:  550, beta:  520, gamma:  580 } },
  { name: "Corona Long Neck",      brand: "Corona",   category: "beer",   packaging_type: "garrafa", packaging_volume_ml: 330,  prices: { alpha:  790, beta:  750, gamma:  820 } },
  { name: "Amstel",                brand: "Amstel",   category: "beer",   packaging_type: "lata",    packaging_volume_ml: 350,  prices: { alpha:  350, beta:  330, gamma:  370 } },
  { name: "Stella Artois Long Neck",brand:"Stella Artois",category:"beer",packaging_type: "garrafa", packaging_volume_ml: 330,  prices: { alpha:  590, beta:  560, gamma:  610 } },
  { name: "Jack Daniel's",         brand: "Jack Daniel's", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 1000, prices: { alpha: 8990, beta: 8700, gamma: 9200 } },
  { name: "Jack Daniel's",         brand: "Jack Daniel's", category: "whisky", packaging_type: "garrafa", packaging_volume_ml:  750, prices: { alpha: 7200, beta: 6990, gamma: 7400 } },
  { name: "Johnnie Walker Red Label", brand: "Johnnie Walker", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 750, prices: { alpha: 8900, beta: 8500, gamma: 9100 } },
  { name: "Ballantine's",          brand: "Ballantine's", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 750, prices: { alpha: 6800, beta: 6500, gamma: 7000 } },
  { name: "Absolut",               brand: "Absolut",  category: "vodka",  packaging_type: "garrafa", packaging_volume_ml: 750,  prices: { alpha: 5490, beta: 5200, gamma: 5600 } },
  { name: "Smirnoff",              brand: "Smirnoff", category: "vodka",  packaging_type: "garrafa", packaging_volume_ml: 998,  prices: { alpha: 4200, beta: 3990, gamma: 4400 } },
  { name: "Red Bull",              brand: "Red Bull", category: "energy", packaging_type: "lata",    packaging_volume_ml: 250,  prices: { alpha:  890, beta:  850, gamma:  920 } },
  { name: "Monster Energy",        brand: "Monster",  category: "energy", packaging_type: "lata",    packaging_volume_ml: 473,  prices: { alpha:  820, beta:  790, gamma:  860 } },
];

// ─── Definição das distribuidoras ─────────────────────────────────────────────

const DISTRIBUTORS = [
  {
    key: "alpha" as const,
    email: "alpha@teste.com",
    company_name: "Distribuidora Alpha Bebidas",
    cnpj: "11111111000101",
    responsible_name: "Carlos Alpha",
    whatsapp_commercial: "11911110001",
    email_commercial: "comercial@alphabebidas.com.br",
    cutoff_time: "15:00",
    delivery_days_business: 1,
    route_days: ["monday", "wednesday", "friday"],
  },
  {
    key: "beta" as const,
    email: "beta@teste.com",
    company_name: "Distribuidora Beta Drinks",
    cnpj: "22222222000102",
    responsible_name: "Ana Beta",
    whatsapp_commercial: "11922220002",
    email_commercial: "comercial@betadrinks.com.br",
    cutoff_time: "12:00",
    delivery_days_business: 2,
    route_days: ["tuesday", "thursday"],
  },
  {
    key: "gamma" as const,
    email: "gamma@teste.com",
    company_name: "Distribuidora Gamma Comercial",
    cnpj: "33333333000103",
    responsible_name: "Pedro Gamma",
    whatsapp_commercial: "11933330003",
    email_commercial: "comercial@gammacomercial.com.br",
    cutoff_time: "18:00",
    delivery_days_business: 1,
    route_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  },
] as const;

type DistributorKey = typeof DISTRIBUTORS[number]["key"];

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Catálogo central de produtos com imagens ─────────────────────────────────

const CATALOG = [
  {
    name: "Heineken Long Neck 330ml",
    brand: "Heineken",
    category: "beer" as const,
    packaging_type: "garrafa" as const,
    packaging_volume_ml: 330,
    image_url: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Heineken Lata 350ml",
    brand: "Heineken",
    category: "beer" as const,
    packaging_type: "lata" as const,
    packaging_volume_ml: 350,
    image_url: "https://images.unsplash.com/photo-1571767454098-246b94fbcf70?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Brahma Lata 350ml",
    brand: "Brahma",
    category: "beer" as const,
    packaging_type: "lata" as const,
    packaging_volume_ml: 350,
    image_url: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Skol Lata 350ml",
    brand: "Skol",
    category: "beer" as const,
    packaging_type: "lata" as const,
    packaging_volume_ml: 350,
    image_url: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Jack Daniel's Tennessee Whiskey 1L",
    brand: "Jack Daniel's",
    category: "whisky" as const,
    packaging_type: "garrafa" as const,
    packaging_volume_ml: 1000,
    image_url: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Absolut Vodka Original 750ml",
    brand: "Absolut",
    category: "vodka" as const,
    packaging_type: "garrafa" as const,
    packaging_volume_ml: 750,
    image_url: "https://images.unsplash.com/photo-1613483186459-58f6e6d06de1?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Red Bull Energy Drink 250ml",
    brand: "Red Bull",
    category: "energy" as const,
    packaging_type: "lata" as const,
    packaging_volume_ml: 250,
    image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Corona Extra Long Neck 330ml",
    brand: "Corona",
    category: "beer" as const,
    packaging_type: "garrafa" as const,
    packaging_volume_ml: 330,
    image_url: "https://images.unsplash.com/photo-1561247226-cf2e57d7d13d?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Budweiser Long Neck 330ml",
    brand: "Budweiser",
    category: "beer" as const,
    packaging_type: "garrafa" as const,
    packaging_volume_ml: 330,
    image_url: "https://images.unsplash.com/photo-1567696911980-2eed69a46f4a?w=200&h=200&fit=crop&q=80",
  },
  {
    name: "Johnnie Walker Red Label 750ml",
    brand: "Johnnie Walker",
    category: "whisky" as const,
    packaging_type: "garrafa" as const,
    packaging_volume_ml: 750,
    image_url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200&h=200&fit=crop&q=80",
  },
];

async function main() {
  console.log("🌱 Iniciando seed...\n");

  // ── 0. Catálogo central de produtos com imagens ────────────────────────────
  await prisma.productCatalog.deleteMany({});
  await prisma.productCatalog.createMany({ data: CATALOG });
  console.log(`  📸 ${CATALOG.length} entradas no catálogo de imagens criadas.`);

  // ── 1. Limpa dados anteriores do seed (na ordem correta para FK) ───────────
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: SEED_EMAILS } },
    select: { id: true, distributor: { select: { id: true } } },
  });

  if (existingUsers.length > 0) {
    const distributorIds = existingUsers
      .map((u) => u.distributor?.id)
      .filter(Boolean) as string[];

    if (distributorIds.length > 0) {
      await prisma.product.deleteMany({ where: { distributor_id: { in: distributorIds } } });
      await prisma.deliveryRegion.deleteMany({ where: { distributor_id: { in: distributorIds } } });
    }

    await prisma.user.deleteMany({ where: { email: { in: SEED_EMAILS } } });
    console.log(`  ♻️  Removidos ${existingUsers.length} usuário(s) anteriores do seed.`);
  }

  // ── 1.5. Configura cidades de cobertura ativa ──────────────────────────────
  await prisma.coverageCity.deleteMany({});
  const citiesToCover = [
    { city: "São Paulo", state: "SP", active: true },
    { city: "Santo André", state: "SP", active: true },
    { city: "São Bernardo do Campo", state: "SP", active: true },
    { city: "São Caetano do Sul", state: "SP", active: true },
    { city: "Guarulhos", state: "SP", active: true },
    { city: "Osasco", state: "SP", active: true },
    { city: "Campinas", state: "SP", active: true },
    { city: "Santos", state: "SP", active: true },
  ];
  await prisma.coverageCity.createMany({ data: citiesToCover });
  console.log(`  📍 ${citiesToCover.length} cidades de cobertura ativa criadas.`);

  // ── 2. Hash de senha (custo 10 — adequado para seed/dev) ──────────────────
  const passwordHash = await bcrypt.hash("senha123", 10);

  // ── 3. Cria usuários, distribuidoras, regiões e produtos ──────────────────
  const createdDistributorIds: Record<DistributorKey, string> = {} as Record<DistributorKey, string>;

  for (const dist of DISTRIBUTORS) {
    const user = await prisma.user.create({
      data: {
        email: dist.email,
        password_hash: passwordHash,
        role: "distributor_admin",
        provider: "credentials",
        distributor: {
          create: {
            company_name: dist.company_name,
            cnpj: dist.cnpj,
            responsible_name: dist.responsible_name,
            whatsapp_commercial: dist.whatsapp_commercial,
            email_commercial: dist.email_commercial,
            plan: "pro",
            plan_status: "active",
            approved_by_admin: true,
            credit_score_minimum: 500,
            credit_accepts_restrictions: false,
            credit_min_cnpj_months: 6,
            delivery_regions: {
              create: {
                city: "São Paulo",
                state: "SP",
                delivery_days_business: dist.delivery_days_business,
                route_days: [...dist.route_days] as string[],
                cutoff_time: dist.cutoff_time,
                minimum_order_cents: 0,
              },
            },
          },
        },
      },
      include: { distributor: { select: { id: true } } },
    }) as { distributor: { id: string } | null };

    createdDistributorIds[dist.key] = user.distributor!.id;
    console.log(`  ✅ ${dist.company_name} (${dist.email}) — ID: ${user.distributor!.id}`);
  }

  // ── 4. Cria os produtos para cada distribuidora ────────────────────────────
  let totalProducts = 0;

  for (const product of PRODUCTS) {
    const entries = (["alpha", "beta", "gamma"] as DistributorKey[]).map((key) => ({
      distributor_id: createdDistributorIds[key],
      name: product.name,
      brand: product.brand,
      category: product.category,
      packaging_type: product.packaging_type,
      packaging_volume_ml: product.packaging_volume_ml,
      price_cents: product.prices[key],
      available: true,
    }));

    await prisma.product.createMany({ data: entries });
    totalProducts += entries.length;
  }

  console.log(`\n  📦 ${totalProducts} produtos criados (${PRODUCTS.length} SKUs × 3 distribuidoras)`);

  // ── 5. Resumo final ────────────────────────────────────────────────────────
  console.log(`
─────────────────────────────────────────────────────────
🎉 Seed concluído com sucesso!

Distribuidoras criadas:
  • alpha@teste.com   → Distribuidora Alpha Bebidas  (corte 15h | seg/qua/sex | 1 dia útil)
  • beta@teste.com    → Distribuidora Beta Drinks    (corte 12h | ter/qui     | 2 dias úteis)
  • gamma@teste.com   → Distribuidora Gamma Comercial (corte 18h | seg–sex     | 1 dia útil)

Senha de todos: senha123
Região de entrega: São Paulo / SP
─────────────────────────────────────────────────────────
`);
}

main()
  .catch((err) => {
    console.error("❌ Erro no seed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
