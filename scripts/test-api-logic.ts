import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface OrderItemSnapshot {
  product_name: string;
  brand: string;
  category?: string;
  packaging?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents?: number;
}

async function main() {
  // Find client barjoao@cliente.seed.hubby
  const user = await prisma.user.findFirst({
    where: { email: "barjoao@cliente.seed.hubby" },
    select: { id: true, email: true }
  });

  if (!user) {
    console.error("User not found!");
    return;
  }

  const client = await prisma.client.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  });

  if (!client) {
    console.error("Client profile not found!");
    return;
  }

  console.log(`Running logic for client id: ${client.id} (${user.email})`);

  // Fetch all orders
  const orders = await prisma.order.findMany({
    where: {
      client_id: client.id,
      status: { not: "rejected" },
    },
    select: {
      id: true,
      group_id: true,
      total_cents: true,
      items_snapshot: true,
      sent_at: true,
      status: true,
      distributor: {
        select: { company_name: true },
      },
    },
  });

  console.log(`Found ${orders.length} orders in query`);

  if (orders.length > 0) {
    console.log("First order details:", {
      id: orders[0].id,
      status: orders[0].status,
      total_cents: orders[0].total_cents,
      items_snapshot: orders[0].items_snapshot,
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
