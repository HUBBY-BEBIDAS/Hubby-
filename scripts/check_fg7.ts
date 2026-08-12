import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "fg7@gmail.com" },
    include: {
      distributor: {
        include: {
          sponsored_slots: true,
          delivery_regions: true,
        },
      },
    },
  });

  console.log("USER FG7:", JSON.stringify(user, null, 2));
}

main().finally(() => prisma.$disconnect());
