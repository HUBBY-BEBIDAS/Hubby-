import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "";
  if (/[?&]sslmode=(require|prefer|verify-ca)(&|$)/.test(url) && !url.includes("uselibpqcompat=")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}uselibpqcompat=true`;
  }
  return url;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getConnectionString() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
