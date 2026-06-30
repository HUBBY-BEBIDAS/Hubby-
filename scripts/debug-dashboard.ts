import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Checking DB users, clients and orders...");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
    }
  });
  console.log(`Total users in DB: ${users.length}`);
  console.log("Users preview:", users.slice(0, 10));

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      company_name: true,
      user: { select: { email: true } }
    }
  });
  console.log(`Total clients in DB: ${clients.length}`);

  const ordersCount = await prisma.order.count();
  console.log(`Total orders in DB: ${ordersCount}`);

  for (const client of clients.slice(0, 5)) {
    const clientOrders = await prisma.order.findMany({
      where: { client_id: client.id },
      select: { id: true, status: true }
    });
    console.log(`Client ${client.user.email} (${client.company_name}) has ${clientOrders.length} orders.`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
