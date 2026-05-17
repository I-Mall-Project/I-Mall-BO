import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Ping DB and auto-reconnect if failed
const pingDB = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(new Date(), "✅ Neon DB ping successful");
  } catch (err) {
    console.error(new Date(), "❌ Neon DB ping failed:", err.message);

    // Attempt reconnect
    try {
      await prisma.$disconnect();
      console.log(new Date(), "🔄 Trying to reconnect Prisma...");
      await prisma.$connect();
      console.log(new Date(), "✅ Reconnected to Neon DB");
    } catch (reconnectErr) {
      console.error(new Date(), "❌ Reconnect failed:", reconnectErr.message);
    }
  }
};

// 🔁 Keep DB connection alive every 4 minutes
setInterval(pingDB, 2 * 60 * 1000); // 4 minutes

// Optional: immediate first ping on server start
pingDB();

export default prisma;
