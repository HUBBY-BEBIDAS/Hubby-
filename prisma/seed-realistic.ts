/**
 * prisma/seed-realistic.ts
 *
 * Seed realista com 3 meses de uso da plataforma (jan–abr 2026).
 *
 * Executar:  npm run seed:realistic
 *            npx tsx prisma/seed-realistic.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter, log: ["warn", "error"] });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rng = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: T[]): T => arr[rng(0, arr.length - 1)];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function varyPrice(baseCents: number, factorPct: number): number {
  return Math.round(baseCents * (1 + factorPct / 100));
}

const PASS_HASH = bcrypt.hashSync("Seed@2026", 10);

const DIST_DOMAIN = "@dist.seed.hubby";
const CLIENT_DOMAIN = "@cliente.seed.hubby";

// ─── Catálogo de produtos (base) ─────────────────────────────────────────────

type ProductBase = {
  name: string;
  brand: string;
  category: string;
  packaging_type: string;
  packaging_volume_ml: number;
  base_price_cents: number;
  image_url: string;
};

const PRODUCT_CATALOG: ProductBase[] = [
  { name: "Heineken Long Neck", brand: "Heineken", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 330, base_price_cents: 490, image_url: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=200&h=200&fit=crop&q=80" },
  { name: "Heineken Lata", brand: "Heineken", category: "beer", packaging_type: "lata", packaging_volume_ml: 350, base_price_cents: 400, image_url: "https://images.unsplash.com/photo-1571767454098-246b94fbcf70?w=200&h=200&fit=crop&q=80" },
  { name: "Heineken", brand: "Heineken", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 600, base_price_cents: 850, image_url: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=200&h=200&fit=crop&q=80" },
  { name: "Brahma Lata", brand: "Brahma", category: "beer", packaging_type: "lata", packaging_volume_ml: 350, base_price_cents: 300, image_url: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=200&h=200&fit=crop&q=80" },
  { name: "Brahma", brand: "Brahma", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 600, base_price_cents: 620, image_url: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=200&h=200&fit=crop&q=80" },
  { name: "Skol Lata", brand: "Skol", category: "beer", packaging_type: "lata", packaging_volume_ml: 350, base_price_cents: 270, image_url: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&h=200&fit=crop&q=80" },
  { name: "Skol", brand: "Skol", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 600, base_price_cents: 580, image_url: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&h=200&fit=crop&q=80" },
  { name: "Budweiser Long Neck", brand: "Budweiser", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 330, base_price_cents: 520, image_url: "https://images.unsplash.com/photo-1567696911980-2eed69a46f4a?w=200&h=200&fit=crop&q=80" },
  { name: "Corona Long Neck", brand: "Corona", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 330, base_price_cents: 790, image_url: "https://images.unsplash.com/photo-1561247226-cf2e57d7d13d?w=200&h=200&fit=crop&q=80" },
  { name: "Stella Artois Long Neck", brand: "Stella Artois", category: "beer", packaging_type: "garrafa", packaging_volume_ml: 330, base_price_cents: 570, image_url: "https://images.unsplash.com/photo-1566294601872-abb81b01a5b7?w=200&h=200&fit=crop&q=80" },
  { name: "Amstel Lata", brand: "Amstel", category: "beer", packaging_type: "lata", packaging_volume_ml: 350, base_price_cents: 330, image_url: "https://images.unsplash.com/photo-1525373698358-041e3a460346?w=200&h=200&fit=crop&q=80" },
  { name: "Jack Daniel's Tennessee Whiskey", brand: "Jack Daniel's", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 1000, base_price_cents: 8990, image_url: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200&h=200&fit=crop&q=80" },
  { name: "Jack Daniel's Tennessee Whiskey", brand: "Jack Daniel's", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 750, base_price_cents: 7200, image_url: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200&h=200&fit=crop&q=80" },
  { name: "Johnnie Walker Red Label", brand: "Johnnie Walker", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 750, base_price_cents: 8900, image_url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200&h=200&fit=crop&q=80" },
  { name: "Johnnie Walker Black Label", brand: "Johnnie Walker", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 750, base_price_cents: 13900, image_url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200&h=200&fit=crop&q=80" },
  { name: "Absolut Vodka", brand: "Absolut", category: "vodka", packaging_type: "garrafa", packaging_volume_ml: 750, base_price_cents: 5490, image_url: "https://images.unsplash.com/photo-1613483186459-58f6e6d06de1?w=200&h=200&fit=crop&q=80" },
  { name: "Smirnoff", brand: "Smirnoff", category: "vodka", packaging_type: "garrafa", packaging_volume_ml: 998, base_price_cents: 4200, image_url: "https://images.unsplash.com/photo-1613483186459-58f6e6d06de1?w=200&h=200&fit=crop&q=80" },
  { name: "Ballantine's", brand: "Ballantine's", category: "whisky", packaging_type: "garrafa", packaging_volume_ml: 750, base_price_cents: 6800, image_url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200&h=200&fit=crop&q=80" },
  { name: "Tanqueray London Dry Gin", brand: "Tanqueray", category: "gin", packaging_type: "garrafa", packaging_volume_ml: 750, base_price_cents: 8500, image_url: "https://images.unsplash.com/photo-1613483186459-58f6e6d06de1?w=200&h=200&fit=crop&q=80" },
  { name: "Red Bull Energy Drink", brand: "Red Bull", category: "energy", packaging_type: "lata", packaging_volume_ml: 250, base_price_cents: 890, image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200&h=200&fit=crop&q=80" },
  { name: "Red Bull Energy Drink", brand: "Red Bull", category: "energy", packaging_type: "lata", packaging_volume_ml: 355, base_price_cents: 1090, image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200&h=200&fit=crop&q=80" },
  { name: "Monster Energy Original", brand: "Monster", category: "energy", packaging_type: "lata", packaging_volume_ml: 473, base_price_cents: 820, image_url: "https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?w=200&h=200&fit=crop&q=80" },
  { name: "Gatorade Limao", brand: "Gatorade", category: "soft_drink", packaging_type: "garrafa", packaging_volume_ml: 500, base_price_cents: 450, image_url: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200&h=200&fit=crop&q=80" },
  { name: "Agua Crystal", brand: "Crystal", category: "water", packaging_type: "garrafa", packaging_volume_ml: 500, base_price_cents: 130, image_url: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200&h=200&fit=crop&q=80" },
  { name: "Agua Crystal", brand: "Crystal", category: "water", packaging_type: "garrafa", packaging_volume_ml: 1500, base_price_cents: 280, image_url: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200&h=200&fit=crop&q=80" },
  { name: "Coca-Cola Lata", brand: "Coca-Cola", category: "soft_drink", packaging_type: "lata", packaging_volume_ml: 350, base_price_cents: 360, image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&h=200&fit=crop&q=80" },
  { name: "Coca-Cola", brand: "Coca-Cola", category: "soft_drink", packaging_type: "garrafa", packaging_volume_ml: 2000, base_price_cents: 890, image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&h=200&fit=crop&q=80" },
  { name: "Guarana Antarctica Lata", brand: "Antarctica", category: "soft_drink", packaging_type: "lata", packaging_volume_ml: 350, base_price_cents: 280, image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&h=200&fit=crop&q=80" },
];

// ─── Distribuidoras ───────────────────────────────────────────────────────────

const DISTRIBUTORS = [
  {
    email: `silva${DIST_DOMAIN}`,
    company_name: "Bebidas Silva & Cia",
    cnpj: "50000001000101",
    responsible_name: "Roberto Silva",
    whatsapp_commercial: "11940001001",
    email_commercial: "comercial@silvaecia.com.br",
    plan: "enterprise" as const,
    price_factor: 0,
    business_hours: { monday:"08:00-18:00", tuesday:"08:00-18:00", wednesday:"08:00-18:00", thursday:"08:00-18:00", friday:"08:00-18:00", saturday:"08:00-12:00", sunday: null },
    regions: [{ city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","wednesday","friday"], cutoff_time:"15:00", minimum_order_cents:30000 }],
  },
  {
    email: `atacadao${DIST_DOMAIN}`,
    company_name: "Atacadão Drink SP",
    cnpj: "50000002000102",
    responsible_name: "Ana Souza",
    whatsapp_commercial: "11940002002",
    email_commercial: "pedidos@atacadaodrink.com.br",
    plan: "business" as const,
    price_factor: -4,
    business_hours: { monday:"07:00-19:00", tuesday:"07:00-19:00", wednesday:"07:00-19:00", thursday:"07:00-19:00", friday:"07:00-19:00", saturday:"07:00-14:00", sunday: null },
    regions: [
      { city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","tuesday","wednesday","thursday","friday"], cutoff_time:"14:00", minimum_order_cents:50000 },
      { city:"Santo André", state:"SP", delivery_days_business:2, route_days:["tuesday","thursday"], cutoff_time:"12:00", minimum_order_cents:60000 },
      { city:"São Bernardo do Campo", state:"SP", delivery_days_business:2, route_days:["monday","wednesday"], cutoff_time:"12:00", minimum_order_cents:60000 },
    ],
  },
  {
    email: `norte${DIST_DOMAIN}`,
    company_name: "Norte Bebidas",
    cnpj: "50000003000103",
    responsible_name: "Carlos Norte",
    whatsapp_commercial: "11940003003",
    email_commercial: "vendas@nortebebidas.com.br",
    plan: "starter" as const,
    price_factor: 3,
    business_hours: { monday:"08:00-17:00", tuesday:"08:00-17:00", wednesday:"08:00-17:00", thursday:"08:00-17:00", friday:"08:00-17:00", saturday: null, sunday: null },
    regions: [{ city:"São Paulo", state:"SP", delivery_days_business:2, route_days:["tuesday","thursday"], cutoff_time:"13:00", minimum_order_cents:20000 }],
  },
  {
    email: `premium${DIST_DOMAIN}`,
    company_name: "Premium Drinks SP",
    cnpj: "50000004000104",
    responsible_name: "Fernanda Alves",
    whatsapp_commercial: "11940004004",
    email_commercial: "contato@premiumdrinks.com.br",
    plan: "pro" as const,
    price_factor: 4,
    business_hours: { monday:"09:00-18:00", tuesday:"09:00-18:00", wednesday:"09:00-18:00", thursday:"09:00-18:00", friday:"09:00-18:00", saturday:"09:00-13:00", sunday: null },
    regions: [
      { city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","wednesday","friday"], cutoff_time:"16:00", minimum_order_cents:40000 },
      { city:"Guarulhos", state:"SP", delivery_days_business:2, route_days:["tuesday","thursday"], cutoff_time:"13:00", minimum_order_cents:50000 },
    ],
  },
  {
    email: `fast${DIST_DOMAIN}`,
    company_name: "Fast Bebidas",
    cnpj: "50000005000105",
    responsible_name: "Paulo Rápido",
    whatsapp_commercial: "11940005005",
    email_commercial: "fast@fastbebidas.com.br",
    plan: "starter" as const,
    price_factor: 1,
    business_hours: { monday:"08:00-18:00", tuesday:"08:00-18:00", wednesday:"08:00-18:00", thursday:"08:00-18:00", friday:"08:00-18:00", saturday:"08:00-12:00", sunday: null },
    regions: [{ city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","tuesday","wednesday","thursday","friday"], cutoff_time:"17:00", minimum_order_cents:15000 }],
  },
  {
    email: `paulista${DIST_DOMAIN}`,
    company_name: "Distribuidora Paulista",
    cnpj: "50000006000106",
    responsible_name: "Marcos Paulista",
    whatsapp_commercial: "11940006006",
    email_commercial: "vendas@distribuidorapaulista.com.br",
    plan: "business" as const,
    price_factor: -3,
    business_hours: { monday:"07:30-18:30", tuesday:"07:30-18:30", wednesday:"07:30-18:30", thursday:"07:30-18:30", friday:"07:30-18:30", saturday:"08:00-13:00", sunday: null },
    regions: [
      { city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","tuesday","wednesday","thursday","friday"], cutoff_time:"14:00", minimum_order_cents:35000 },
      { city:"Osasco", state:"SP", delivery_days_business:2, route_days:["monday","thursday"], cutoff_time:"12:00", minimum_order_cents:40000 },
      { city:"São Caetano do Sul", state:"SP", delivery_days_business:2, route_days:["tuesday","friday"], cutoff_time:"12:00", minimum_order_cents:40000 },
    ],
  },
  {
    email: `topdrinks${DIST_DOMAIN}`,
    company_name: "Top Drinks",
    cnpj: "50000007000107",
    responsible_name: "Beatriz Top",
    whatsapp_commercial: "11940007007",
    email_commercial: "pedidos@topdrinks.com.br",
    plan: "pro" as const,
    price_factor: 2,
    business_hours: { monday:"08:00-18:00", tuesday:"08:00-18:00", wednesday:"08:00-18:00", thursday:"08:00-18:00", friday:"08:00-18:00", saturday:"08:00-12:00", sunday: null },
    regions: [{ city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","wednesday","friday"], cutoff_time:"15:30", minimum_order_cents:25000 }],
  },
  {
    email: `mega${DIST_DOMAIN}`,
    company_name: "Mega Bebidas SP",
    cnpj: "50000008000108",
    responsible_name: "Eduardo Mega",
    whatsapp_commercial: "11940008008",
    email_commercial: "mega@megabebidas.com.br",
    plan: "enterprise" as const,
    price_factor: -6,
    business_hours: { monday:"06:00-20:00", tuesday:"06:00-20:00", wednesday:"06:00-20:00", thursday:"06:00-20:00", friday:"06:00-20:00", saturday:"06:00-16:00", sunday:"08:00-12:00" },
    regions: [
      { city:"São Paulo", state:"SP", delivery_days_business:1, route_days:["monday","tuesday","wednesday","thursday","friday","saturday"], cutoff_time:"18:00", minimum_order_cents:20000 },
      { city:"Guarulhos", state:"SP", delivery_days_business:1, route_days:["monday","wednesday","friday"], cutoff_time:"14:00", minimum_order_cents:25000 },
      { city:"Campinas", state:"SP", delivery_days_business:2, route_days:["tuesday","thursday"], cutoff_time:"12:00", minimum_order_cents:50000 },
      { city:"Santos", state:"SP", delivery_days_business:2, route_days:["wednesday","friday"], cutoff_time:"11:00", minimum_order_cents:50000 },
    ],
  },
  {
    email: `abc${DIST_DOMAIN}`,
    company_name: "Distribuidora ABC Santo André",
    cnpj: "50000009000109",
    responsible_name: "Marcelo Santo André",
    whatsapp_commercial: "11940009009",
    email_commercial: "comercial@abcsantoandre.com.br",
    plan: "pro" as const,
    price_factor: 1,
    business_hours: { monday:"08:00-18:00", tuesday:"08:00-18:00", wednesday:"08:00-18:00", thursday:"08:00-18:00", friday:"08:00-18:00", saturday:"08:00-13:00", sunday: null },
    regions: [
      { city:"Santo André", state:"SP", delivery_days_business:1, route_days:["monday","wednesday","friday"], cutoff_time:"16:00", minimum_order_cents:30000 },
      { city:"São Bernardo do Campo", state:"SP", delivery_days_business:2, route_days:["tuesday","thursday"], cutoff_time:"14:00", minimum_order_cents:40000 },
      { city:"São Caetano do Sul", state:"SP", delivery_days_business:2, route_days:["tuesday","friday"], cutoff_time:"14:00", minimum_order_cents:40000 },
    ],
  },
] as const;

// ─── Clientes ─────────────────────────────────────────────────────────────────

const CLIENTS = [
  { email:`barjoao${CLIENT_DOMAIN}`, company:"Bar do João", cnpj:"60000001000101", type:"bar", responsible:"João Ferreira", whatsapp:"11950001001" },
  { email:`bellaitalia${CLIENT_DOMAIN}`, company:"Restaurante Bella Italia", cnpj:"60000002000102", type:"restaurant", responsible:"Maria Conti", whatsapp:"11950002002" },
  { email:`adeganoble${CLIENT_DOMAIN}`, company:"Adega Nobre", cnpj:"60000003000103", type:"adega", responsible:"Pedro Nobre", whatsapp:"11950003003" },
  { email:`hotelibi${CLIENT_DOMAIN}`, company:"Hotel Ibirapuera", cnpj:"60000004000104", type:"hotel", responsible:"Clarice Hotel", whatsapp:"11950004004" },
  { email:`mercadosp${CLIENT_DOMAIN}`, company:"Mercado São Paulo", cnpj:"60000005000105", type:"supermarket", responsible:"Lucas Mercado", whatsapp:"11950005005" },
  { email:`club90${CLIENT_DOMAIN}`, company:"Casa Noturna Club 90", cnpj:"60000006000106", type:"nightclub", responsible:"DJ Carlos", whatsapp:"11950006006" },
  { email:`saborarte${CLIENT_DOMAIN}`, company:"Restaurante Sabor & Arte", cnpj:"60000007000107", type:"restaurant", responsible:"Chef Amanda", whatsapp:"11950007007" },
  { email:`baresquina${CLIENT_DOMAIN}`, company:"Bar da Esquina", cnpj:"60000008000108", type:"bar", responsible:"Seu Zé", whatsapp:"11950008008" },
  { email:`bellanapoli${CLIENT_DOMAIN}`, company:"Pizzaria Bella Napoli", cnpj:"60000009000109", type:"restaurant", responsible:"Gustavo Napoli", whatsapp:"11950009009" },
  { email:`adegapremium${CLIENT_DOMAIN}`, company:"Adega Premium", cnpj:"60000010000110", type:"adega", responsible:"Sandra Wine", whatsapp:"11950010010" },
  { email:`bargrill${CLIENT_DOMAIN}`, company:"Bar & Grill Copan", cnpj:"60000011000111", type:"bar", responsible:"Rafael Grill", whatsapp:"11950011011" },
  { email:`hotelpaulista${CLIENT_DOMAIN}`, company:"Hotel Paulista", cnpj:"60000012000112", type:"hotel", responsible:"Joana Hotel", whatsapp:"11950012012" },
  { email:`mercadobom${CLIENT_DOMAIN}`, company:"Mercado Bom Preço", cnpj:"60000013000113", type:"supermarket", responsible:"Renato Mercado", whatsapp:"11950013013" },
  { email:`conv24h${CLIENT_DOMAIN}`, company:"Conveniência 24h", cnpj:"60000014000114", type:"convenience", responsible:"Aline Conv", whatsapp:"11950014014" },
  { email:`buffetsp${CLIENT_DOMAIN}`, company:"Buffet Eventos SP", cnpj:"60000015000115", type:"other", responsible:"Luciana Eventos", whatsapp:"11950015015" },
];

// ─── Comentários realistas para avaliações ────────────────────────────────────

const REVIEW_COMMENTS = [
  "Entrega no prazo, produtos em perfeito estado. Recomendo!",
  "Atendimento excelente, preços competitivos. Continuo comprando.",
  "Entrega rápida e embalagem bem feita. Muito satisfeito.",
  "Bom atendimento, mas a entrega atrasou um dia.",
  "Produtos frescos e bem conservados. Ótima distribuidora.",
  "Preço justo e qualidade garantida. Voltarei a comprar.",
  "Excelente! Chegou antes do prazo e tudo correto.",
  "Comunicação ágil e produtos conforme pedido.",
  "Boa distribuidora, mas poderia ter mais variedade.",
  "Rápidos e eficientes. Melhor custo-benefício da região.",
  "Sempre pontual e com nota fiscal correta. 10 estrelas!",
  "Produtos de qualidade. Parceiro ideal para meu bar.",
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed realista...\n");

  // ── 0. Remove dados anteriores do seed realista ──────────────────────────
  const allEmails = [
    ...DISTRIBUTORS.map((d) => d.email),
    ...CLIENTS.map((c) => c.email),
  ];

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: allEmails } },
    select: { id: true, distributor: { select: { id: true } }, client: { select: { id: true } } },
  });

  const distIds = existingUsers.map((u) => u.distributor?.id).filter(Boolean) as string[];
  const clientIds = existingUsers.map((u) => u.client?.id).filter(Boolean) as string[];

  if (distIds.length > 0 || clientIds.length > 0) {
    // Limpa na ordem correta (FK)
    if (clientIds.length > 0) {
      await prisma.favoriteDistributor.deleteMany({ where: { client_id: { in: clientIds } } });
      await prisma.monthlyReport.deleteMany({ where: { client_id: { in: clientIds } } });
      await prisma.review.deleteMany({ where: { client_id: { in: clientIds } } });
      await prisma.paymentFeedback.deleteMany({ where: { client_id: { in: clientIds } } });
      await prisma.clientCredential.deleteMany({ where: { client_id: { in: clientIds } } });
      await prisma.order.deleteMany({ where: { client_id: { in: clientIds } } });
      await prisma.quotation.deleteMany({ where: { client_id: { in: clientIds } } });
    }
    if (distIds.length > 0) {
      await prisma.promotion.deleteMany({ where: { distributor_id: { in: distIds } } });
      await prisma.notification.deleteMany({
        where: { user: { distributor: { id: { in: distIds } } } },
      });
      await prisma.product.deleteMany({ where: { distributor_id: { in: distIds } } });
      await prisma.deliveryRegion.deleteMany({ where: { distributor_id: { in: distIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
    console.log(`  ♻️  Removidos ${existingUsers.length} usuário(s) anteriores do seed realista.`);
  }

  // ── 0.5. Configura cidades de cobertura ativa ──────────────────────────────
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

  // ── 1. Atualiza catálogo de produtos (upsert) ────────────────────────────
  for (const p of PRODUCT_CATALOG) {
    await prisma.productCatalog.upsert({
      where: {
        id: `catalog-${p.brand}-${p.name}-${p.packaging_volume_ml}`.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,""),
      },
      // Se não existir, cria — se existir, ignora
      create: {
        name: p.name,
        brand: p.brand,
        category: p.category as never,
        packaging_type: p.packaging_type as never,
        packaging_volume_ml: p.packaging_volume_ml,
        image_url: p.image_url,
      },
      update: { image_url: p.image_url },
    }).catch(() => null); // Ignora conflito de id artificial
  }
  // Garante catálogo via upsert por (brand+name+volume) de forma mais robusta
  for (const p of PRODUCT_CATALOG) {
    await prisma.productCatalog.findFirst({
      where: { brand: p.brand, name: p.name, packaging_volume_ml: p.packaging_volume_ml },
    }).then(async (existing) => {
      if (!existing) {
        await prisma.productCatalog.create({
          data: {
            name: p.name, brand: p.brand,
            category: p.category as never,
            packaging_type: p.packaging_type as never,
            packaging_volume_ml: p.packaging_volume_ml,
            image_url: p.image_url,
          },
        });
      }
    });
  }
  console.log(`  📸 Catálogo de ${PRODUCT_CATALOG.length} produtos atualizado.`);

  // ── 2. Cria distribuidoras ────────────────────────────────────────────────
  const distributorMap = new Map<string, { id: string; userId: string; products: { id: string; name: string; brand: string; category: string; price_cents: number; packaging_volume_ml: number }[] }>();

  for (const dist of DISTRIBUTORS) {
    const user = await prisma.user.create({
      data: {
        email: dist.email,
        password_hash: PASS_HASH,
        role: "distributor_admin",
        provider: "credentials",
        distributor: {
          create: {
            company_name: dist.company_name,
            cnpj: dist.cnpj,
            responsible_name: dist.responsible_name,
            whatsapp_commercial: dist.whatsapp_commercial,
            email_commercial: dist.email_commercial,
            plan: dist.plan,
            plan_status: "active",
            approved_by_admin: true,
            business_hours: dist.business_hours,
            accepts_orders_outside_hours: false,
            delivery_regions: {
              create: dist.regions.map((r) => ({
                city: r.city,
                state: r.state,
                delivery_days_business: r.delivery_days_business,
                route_days: [...r.route_days],
                cutoff_time: r.cutoff_time,
                minimum_order_cents: r.minimum_order_cents,
                freight_type: "free",
              })),
            },
          },
        },
      },
      include: { distributor: { select: { id: true } } },
    });

    const distributorId = user.distributor!.id;

    // Cria produtos com variação de preço
    const productsToCreate = PRODUCT_CATALOG.map((p) => ({
      distributor_id: distributorId,
      name: p.name,
      brand: p.brand,
      category: p.category as never,
      packaging_type: p.packaging_type as never,
      packaging_volume_ml: p.packaging_volume_ml,
      price_cents: varyPrice(p.base_price_cents, dist.price_factor + rng(-2, 2)),
      available: true,
      image_url: p.image_url,
      image_source: "hubby_catalog" as const,
      price_updated_at: randomDate(new Date("2026-01-01"), new Date("2026-04-25")),
    }));

    await prisma.product.createMany({ data: productsToCreate });

    const createdProducts = await prisma.product.findMany({
      where: { distributor_id: distributorId },
      select: { id: true, name: true, brand: true, category: true, price_cents: true, packaging_volume_ml: true },
    });

    distributorMap.set(dist.email, { id: distributorId, userId: user.id, products: createdProducts });
    console.log(`  ✅ ${dist.company_name} — ${dist.plan} — ${createdProducts.length} produtos`);
  }

  // ── 3. Cria clientes ──────────────────────────────────────────────────────
  const clientMap = new Map<string, { id: string; userId: string }>();

  for (const client of CLIENTS) {
    const user = await prisma.user.create({
      data: {
        email: client.email,
        password_hash: PASS_HASH,
        role: "client",
        provider: "credentials",
        client: {
          create: {
            company_name: client.company,
            cnpj: client.cnpj,
            establishment_type: client.type as never,
            delivery_city: "São Paulo",
            delivery_state: "SP",
            delivery_address_full: `Rua Exemplo, 100 — São Paulo/SP`,
            responsible_name: client.responsible,
            whatsapp: client.whatsapp,
          },
        },
      },
      include: { client: { select: { id: true } } },
    });
    clientMap.set(client.email, { id: user.client!.id, userId: user.id });
  }
  console.log(`\n  👥 ${CLIENTS.length} clientes criados.`);

  // Distribuidoras como array para facilitar seleção aleatória
  const distArray = [...distributorMap.values()];

  // ── 4. Credenciais pré-aprovadas (cada cliente × cada distribuidora) ───────
  for (const clientEntry of clientMap.values()) {
    await prisma.clientCredential.createMany({
      data: distArray.map((d) => ({
        client_id: clientEntry.id,
        distributor_id: d.id,
        status: "approved" as const,
        credit_score: rng(600, 900),
        approved_at: new Date("2026-01-01"),
        expires_at: new Date("2027-01-01"),
      })),
    });
  }
  console.log(`  🔐 Credenciais criadas (${CLIENTS.length} × ${distArray.length}).`);

  // ── 5. Pedidos — jan a abr 2026 ───────────────────────────────────────────
  const JAN = { start: new Date("2026-01-05"), end: new Date("2026-01-31") };
  const FEV = { start: new Date("2026-02-03"), end: new Date("2026-02-28") };
  const MAR = { start: new Date("2026-03-03"), end: new Date("2026-03-31") };
  const ABR = { start: new Date("2026-04-01"), end: new Date("2026-04-25") };
  const PERIODS = [JAN, FEV, MAR, ABR];
  const ORDERS_PER_PERIOD = [3, 3, 3, 2]; // por cliente por período

  const allOrders: { orderId: string; distId: string; clientId: string; sentAt: Date; totalCents: number; status: string }[] = [];

  const STATUS_POOL = ["sent", "viewed", "approved", "approved", "approved"] as const;

  for (const [email, clientEntry] of clientMap.entries()) {
    const clientId = clientEntry.id;

    for (let periodIdx = 0; periodIdx < PERIODS.length; periodIdx++) {
      const period = PERIODS[periodIdx];
      const numOrders = ORDERS_PER_PERIOD[periodIdx] + rng(0, 2);

      for (let oi = 0; oi < numOrders; oi++) {
        const sentAt = randomDate(period.start, period.end);
        const groupId = `group-${clientId}-${sentAt.getTime()}-${oi}`;

        // Sorteia 1-3 distribuidoras para este pedido (simula multi-distribuidor)
        const numDists = rng(1, 3);
        const shuffledDists = [...distArray].sort(() => Math.random() - 0.5).slice(0, numDists);

        // Cria a cotação
        const quotation = await prisma.quotation.create({
          data: {
            client_id: clientId,
            status: "open",
            delivery_city: "São Paulo",
            delivery_state: "SP",
            max_delivery_days: rng(2, 5),
            created_at: sentAt,
            updated_at: sentAt,
          },
        });

        // Seleciona 2-6 produtos aleatórios para a cotação
        const firstDist = shuffledDists[0];
        const numItems = rng(2, 6);
        const selectedProducts = [...firstDist.products].sort(() => Math.random() - 0.5).slice(0, numItems);

        // Cria QuotationItems
        await prisma.quotationItem.createMany({
          data: selectedProducts.map((p) => ({
            quotation_id: quotation.id,
            product_name: p.name,
            brand: p.brand,
            category: p.category as never,
            packaging: p.name,
            quantity: rng(6, 48),
          })),
        });

        const quotItems = await prisma.quotationItem.findMany({
          where: { quotation_id: quotation.id },
        });

        // Cria pedido para cada distribuidora selecionada
        for (const dist of shuffledDists) {
          const status = pick([...STATUS_POOL]);

          // Calcula total baseado nos produtos desta distribuidora
          const itemsSnapshot = quotItems.map((qi) => {
            const distProduct = dist.products.find(
              (p) => p.name === qi.product_name && p.brand === qi.brand
            ) ?? dist.products[rng(0, dist.products.length - 1)];
            const qty = qi.quantity;
            const unitPrice = distProduct.price_cents;
            return {
              product_name: qi.product_name,
              brand: qi.brand,
              category: qi.category,
              packaging: qi.packaging,
              quantity: qty,
              unit_price_cents: unitPrice,
              total_price_cents: unitPrice * qty,
            };
          });

          const totalCents = itemsSnapshot.reduce((s, i) => s + i.total_price_cents, 0);

          // Calcula data de entrega
          const deliveryDays = rng(1, 3);
          const estimatedDelivery = new Date(sentAt);
          estimatedDelivery.setDate(estimatedDelivery.getDate() + deliveryDays);

          const order = await prisma.order.create({
            data: {
              quotation_id: quotation.id,
              client_id: clientId,
              distributor_id: dist.id,
              group_id: groupId,
              status,
              total_cents: totalCents,
              items_snapshot: itemsSnapshot,
              estimated_delivery_date: estimatedDelivery,
              sent_at: sentAt,
              updated_at: sentAt,
              send_channel: pick(["whatsapp", "email", "both"]),
            },
          });

          allOrders.push({
            orderId: order.id,
            distId: dist.id,
            clientId,
            sentAt,
            totalCents,
            status,
          });
        }
      }
    }
    void email;
  }

  console.log(`  📦 ${allOrders.length} pedidos criados (Jan–Abr 2026).`);

  // ── 6. Avaliações (60% dos approved) ─────────────────────────────────────
  const approvedOrders = allOrders.filter((o) => o.status === "approved");
  let reviewCount = 0;

  for (const o of approvedOrders) {
    if (Math.random() > 0.6) continue; // ~60% têm avaliação

    const rating = Math.round((3.5 + Math.random() * 1.5) * 2) / 2; // 3.5–5.0 em 0.5
    const hasComment = Math.random() > 0.4;

    await prisma.review.create({
      data: {
        client_id: o.clientId,
        distributor_id: o.distId,
        order_id: o.orderId,
        rating: Math.round(rating),
        rating_response_time: rng(3, 5),
        rating_service_quality: rng(3, 5),
        rating_price_fairness: rng(3, 5),
        comment: hasComment ? pick(REVIEW_COMMENTS) : null,
        created_at: new Date(o.sentAt.getTime() + 86400000 * rng(1, 5)),
      },
    }).catch(() => null); // ignora duplicatas (unique por client+dist+order)
    reviewCount++;
  }
  console.log(`  ⭐ ${reviewCount} avaliações criadas.`);

  // Atualiza médias das distribuidoras
  for (const dist of distArray) {
    const reviews = await prisma.review.findMany({
      where: { distributor_id: dist.id },
      select: { rating: true },
    });
    if (reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await prisma.distributor.update({
        where: { id: dist.id },
        data: { average_rating: Math.round(avg * 100) / 100, review_count: reviews.length },
      });
    }
  }

  // ── 7. Promoções ativas ───────────────────────────────────────────────────
  const silvaEntry = distributorMap.get(`silva${DIST_DOMAIN}`)!;
  const atacadaoEntry = distributorMap.get(`atacadao${DIST_DOMAIN}`)!;
  const topEntry = distributorMap.get(`topdrinks${DIST_DOMAIN}`)!;

  const heinekenLNSilva = silvaEntry.products.find((p) => p.name.includes("Heineken Long Neck") && p.name.includes("330"));
  const jackAtacadao = atacadaoEntry.products.find((p) => p.brand === "Jack Daniel's" && p.name.includes("1000") === false && p.name.includes("Tennessee"));
  const jackAtacadao1L = atacadaoEntry.products.find((p) => p.brand === "Jack Daniel's" && p.name.includes("Whiskey"));
  const redBullTop = topEntry.products.find((p) => p.brand === "Red Bull" && p.name.includes("250"));

  const NOW = new Date();
  const END_MONTH = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0, 23, 59, 59);
  const END_WEEKEND = new Date(NOW);
  END_WEEKEND.setDate(NOW.getDate() + 7);

  if (heinekenLNSilva) {
    await prisma.promotion.create({
      data: {
        distributor_id: silvaEntry.id,
        product_id: heinekenLNSilva.id,
        type: "percentage",
        discount_percentage: 15,
        starts_at: new Date("2026-04-01"),
        ends_at: END_MONTH,
        description: "Promoção de verão — estoque limitado",
        active: true,
      },
    });
  }

  const jackToUse = jackAtacadao ?? jackAtacadao1L ?? atacadaoEntry.products.find((p) => p.brand === "Jack Daniel's");
  if (jackToUse) {
    await prisma.promotion.create({
      data: {
        distributor_id: atacadaoEntry.id,
        product_id: jackToUse.id,
        type: "fixed_price",
        promotional_price_cents: 7990,
        starts_at: new Date("2026-04-15"),
        ends_at: END_MONTH,
        description: "Preço especial Jack Daniel's",
        active: true,
      },
    });
  }

  if (redBullTop) {
    await prisma.promotion.create({
      data: {
        distributor_id: topEntry.id,
        product_id: redBullTop.id,
        type: "percentage",
        discount_percentage: 10,
        starts_at: new Date("2026-04-25"),
        ends_at: END_WEEKEND,
        description: "Fim de semana energético",
        active: true,
      },
    });
  }

  console.log("  🏷️  3 promoções ativas criadas.");

  // ── 8. Favoritos ─────────────────────────────────────────────────────────
  let favCount = 0;
  for (const clientEntry of clientMap.values()) {
    const numFavs = rng(1, 4);
    const favDists = [...distArray].sort(() => Math.random() - 0.5).slice(0, numFavs);
    for (const d of favDists) {
      await prisma.favoriteDistributor.create({
        data: { client_id: clientEntry.id, distributor_id: d.id },
      }).catch(() => null);
      favCount++;
    }
  }
  console.log(`  ❤️  ${favCount} favoritos criados.`);

  // ── 9. Feedback de pagamento ──────────────────────────────────────────────
  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000);
  const oldOrders = allOrders.filter((o) => o.sentAt < fifteenDaysAgo && o.status === "approved");
  let feedbackCount = 0;

  for (const o of oldOrders) {
    const roll = Math.random();
    if (roll > 0.30) continue; // 70% têm feedback

    const isLate = Math.random() < 0.05; // 5% problema
    await prisma.paymentFeedback.create({
      data: {
        order_id: o.orderId,
        distributor_id: o.distId,
        client_id: o.clientId,
        status: isLate ? "problem" : "ok",
        problem_type: isLate ? "late_payment" : null,
        notes: isLate ? "Pagamento com atraso de 3 dias." : null,
        responded_at: new Date(o.sentAt.getTime() + 86400000 * rng(1, 10)),
        created_at: o.sentAt,
      },
    }).catch(() => null);
    feedbackCount++;
  }
  console.log(`  💳 ${feedbackCount} feedbacks de pagamento criados.`);

  // ── 10. Notificações para distribuidoras ──────────────────────────────────
  const NOTIF_TYPES = ["new_order", "new_credential_request", "credential_auto_approved"] as const;
  let notifCount = 0;

  for (const dist of distributorMap.values()) {
    const numNotifs = rng(3, 8);
    for (let n = 0; n < numNotifs; n++) {
      const type = pick([...NOTIF_TYPES]);
      await prisma.notification.create({
        data: {
          user_id: dist.userId,
          type,
          title: type === "new_order" ? "Nova cotação recebida" : type === "new_credential_request" ? "Nova ficha cadastral" : "Cliente aprovado automaticamente",
          body: type === "new_order"
            ? `Um comprador enviou uma cotação para você. Responda rapidamente!`
            : type === "new_credential_request"
              ? "Um novo cliente solicitou credenciamento. Verifique as informações."
              : "O sistema aprovou automaticamente um novo cliente com base no score de crédito.",
          read: false,
          created_at: randomDate(new Date("2026-04-01"), new Date("2026-04-25")),
        },
      });
      notifCount++;
    }
  }
  console.log(`  🔔 ${notifCount} notificações criadas.`);

  // ── 11. Relatórios mensais (Jan, Fev, Mar) ────────────────────────────────
  const REPORT_MONTHS = [
    { month: 1, year: 2026, start: new Date("2026-01-01"), end: new Date("2026-02-01") },
    { month: 2, year: 2026, start: new Date("2026-02-01"), end: new Date("2026-03-01") },
    { month: 3, year: 2026, start: new Date("2026-03-01"), end: new Date("2026-04-01") },
  ];

  let reportCount = 0;

  for (const [, clientEntry] of clientMap.entries()) {
    const clientId = clientEntry.id;

    for (const period of REPORT_MONTHS) {
      const monthOrders = allOrders.filter(
        (o) => o.clientId === clientId && o.sentAt >= period.start && o.sentAt < period.end
      );

      const monthQuotations = await prisma.quotation.findMany({
        where: {
          client_id: clientId,
          created_at: { gte: period.start, lt: period.end },
        },
        select: { id: true, items: { select: { product_name: true, brand: true } }, orders: { select: { distributor_id: true } } },
      });

      const totalOrders = monthOrders.length;
      const totalValueCents = monthOrders.reduce((s, o) => s + o.totalCents, 0);
      const avgDistributors = monthQuotations.length > 0
        ? monthQuotations.reduce((s, q) => s + q.orders.length, 0) / monthQuotations.length
        : 0;

      // Top distribuidoras
      const distMap2 = new Map<string, { name: string; order_count: number; value_cents: number }>();
      for (const o of monthOrders) {
        const dist2 = distArray.find((d) => d.id === o.distId);
        const name = DISTRIBUTORS.find((d) => {
          const entry = distributorMap.get(d.email);
          return entry?.id === o.distId;
        })?.company_name ?? "Distribuidora";
        const entry2 = distMap2.get(o.distId) ?? { name, order_count: 0, value_cents: 0 };
        entry2.order_count++;
        entry2.value_cents += o.totalCents;
        distMap2.set(o.distId, entry2);
        void dist2;
      }
      const topDistributors = [...distMap2.values()].sort((a, b) => b.value_cents - a.value_cents).slice(0, 3);

      // Produtos mais cotados
      const productMap2 = new Map<string, { product_name: string; brand: string; quote_count: number }>();
      for (const q of monthQuotations) {
        for (const item of q.items) {
          const key = `${item.brand}|${item.product_name}`;
          const e = productMap2.get(key) ?? { product_name: item.product_name, brand: item.brand, quote_count: 0 };
          e.quote_count++;
          productMap2.set(key, e);
        }
      }
      const topProducts = [...productMap2.values()].sort((a, b) => b.quote_count - a.quote_count).slice(0, 5);

      await prisma.monthlyReport.upsert({
        where: { client_id_month_year: { client_id: clientId, month: period.month, year: period.year } },
        create: {
          client_id: clientId,
          month: period.month,
          year: period.year,
          total_quotations: monthQuotations.length,
          total_orders: totalOrders,
          total_value_cents: totalValueCents,
          estimated_savings_cents: 0,
          avg_distributors_per_quotation: avgDistributors,
          top_distributors: topDistributors,
          top_products: topProducts,
        },
        update: {
          total_quotations: monthQuotations.length,
          total_orders: totalOrders,
          total_value_cents: totalValueCents,
          estimated_savings_cents: 0,
          avg_distributors_per_quotation: avgDistributors,
          top_distributors: topDistributors,
          top_products: topProducts,
        },
      });
      reportCount++;
    }
  }
  console.log(`  📊 ${reportCount} relatórios mensais gerados.`);

  // ── Resumo final ──────────────────────────────────────────────────────────
  const totalProducts = PRODUCT_CATALOG.length * DISTRIBUTORS.length;
  console.log(`
─────────────────────────────────────────────────────────────────────
🎉 Seed realista concluído!

  Distribuidoras:  ${DISTRIBUTORS.length} (aprovadas, planos Starter→Enterprise)
  Produtos:        ~${totalProducts} (${PRODUCT_CATALOG.length} SKUs × ${DISTRIBUTORS.length} distribuidoras)
  Clientes:        ${CLIENTS.length}
  Pedidos:         ${allOrders.length} (Jan–Abr 2026)
  Avaliações:      ${reviewCount}
  Promoções:       3 ativas
  Favoritos:       ${favCount}
  Feedbacks:       ${feedbackCount}
  Notificações:    ${notifCount}
  Relatórios:      ${reportCount} (Jan, Fev, Mar × ${CLIENTS.length} clientes)

Credenciais de acesso (senha: Seed@2026):
  Distribuidoras: silva@dist.seed.hubby, atacadao@dist.seed.hubby, ...
  Clientes:       barjoao@cliente.seed.hubby, bellaitalia@cliente.seed.hubby, ...
─────────────────────────────────────────────────────────────────────
`);
}

main()
  .catch((err) => { console.error("❌ Erro no seed realista:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
