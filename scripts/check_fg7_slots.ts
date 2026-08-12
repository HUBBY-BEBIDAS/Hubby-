import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "fg7@gmail.com" },
    include: {
      distributor: {
        include: {
          sponsored_slots: true,
        },
      },
    },
  });

  console.log("SPONSORED SLOTS:", JSON.stringify(user?.distributor?.sponsored_slots, null, 2));
}

main().finally(() => prisma.$disconnect());
