// keepAlivePrisma.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Keep-alive ping: Neon DB idle হবার আগেই connection active রাখবে
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(new Date(), "DB ping successful ✅");
  } catch (err) {
    console.error(new Date(), "DB ping failed ❌", err);
  }
}, 5 * 60 * 1000); // প্রতি 5 মিনিটে

// Example: simple test query
async function testConnection() {
  try {
    const user = await prisma.user.findFirst();
    console.log("Test query success:", user);
  } catch (err) {
    console.error("Test query failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

// Uncomment to run test once
// testConnection();

export default prisma;
