import { PrismaClient } from "@prisma/client";

// Global singleton (VERY IMPORTANT for Vercel / Nodemon)
const globalForPrisma = globalThis;

// Create only ONE Prisma instance
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"], // optional
  });

// Store in global (prevents multiple connections)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;