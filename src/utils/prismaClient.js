import { PrismaClient } from "@prisma/client";

// Global singleton for Vercel / serverless
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"], // keep only errors
  });

// store instance globally (VERY IMPORTANT)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default { prisma };