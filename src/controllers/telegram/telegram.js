// controllers/telegram.controller.js

import prisma from "../../utils/prismaClient.js";
import sendTelegramMessage from "../../utils/Sendtelegram.js";
import { resolveOffer } from "../../utils/assignRider.js";

const TELEGRAM_BOT_TOKEN = "8799190154:AAGxK9HPqjBazBs4LTIM3cU1_f-3Fgpul5k";

const answerCallbackQuery = async (callbackQueryId, text) => {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    }
  );
};

export const telegramWebhook = async (req, res) => {
  try {
    const body = req.body;

    // ✅ Inline button callback (Accept/Reject)
    if (body.callback_query) {
      const { data, from, id: callbackId } = body.callback_query;

      if (data.startsWith("accept_") || data.startsWith("reject_")) {
        const accepted = data.startsWith("accept_");
        const orderId  = data.replace("accept_", "").replace("reject_", "");

        const rider = await prisma.user.findFirst({
          where: { telegramChatId: String(from.id) },
        });

        if (!rider) {
          await answerCallbackQuery(callbackId, "❌ Rider পাওয়া যায়নি");
          return res.sendStatus(200);
        }

        if (accepted) {
          // ✅ Order এখনো unassigned কিনা check করো
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { orderItems: true },
          });

          if (!order) {
            await answerCallbackQuery(callbackId, "❌ Order পাওয়া যায়নি");
            return res.sendStatus(200);
          }

          if (order.deliveryManId) {
            // অন্য rider নিয়ে গেছে
            await answerCallbackQuery(callbackId, "⚠️ এই order আগেই assign হয়ে গেছে!");
            return res.sendStatus(200);
          }

          // ✅ DB তে assign করো
          await prisma.order.update({
            where: { id: orderId },
            data: { deliveryManId: rider.id, assignedAt: new Date() },
          });

          // ✅ pendingOffers resolve করো (server restart না হলে)
          resolveOffer(orderId, rider.id, true);

          const bdTime = new Date(Date.now() + 6 * 60 * 60 * 1000)
            .toISOString().replace("T", " ").slice(0, 16);

          const itemList = order.orderItems
            ?.map(i => {
              const brand = i.brandName ? `${i.brandName} — ` : "";
              const size  = i.size ? ` (${i.size})` : "";
              return `  • ${brand}${i.name}${size} ×${i.quantity}`;
            })
            .join("\n") || "—";

          await sendTelegramMessage(
            String(from.id),
`✅ <b>Order Confirmed!</b>

📋 <b>Invoice:</b> #${order.invoiceNumber}
👤 <b>Customer:</b> ${order.customerName}
📞 <b>Phone:</b> <a href="tel:${order.customerPhone}">${order.customerPhone}</a>
📍 <b>Address:</b> ${order.customerAddress}, ${order.customerCity}

🛍️ <b>Products:</b>
${itemList}

💰 <b>Total:</b> ৳${order.subtotal}
💳 <b>Payment:</b> ${order.paymentMethod || "COD"}
⏰ <b>Assigned:</b> ${bdTime} (BD Time)

👉 <a href="https://admin.i-mall.com.bd/delivery">Dashboard এ যান</a>`
          );

          await answerCallbackQuery(callbackId, "✅ Order Accept হয়েছে!");

        } else {
          // ✅ Reject
          resolveOffer(orderId, rider.id, false);
          await answerCallbackQuery(callbackId, "❌ Reject হয়েছে");
        }
      }

      return res.sendStatus(200);
    }

    // ✅ Regular message
    const { message } = body;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id.toString();
    const text   = message.text?.trim();

    if (text?.startsWith("/start")) {
      await sendTelegramMessage(chatId,
        `👋 <b>iMall Delivery Bot</b> এ স্বাগতম!\n\niMall এ login করার <b>email</b> পাঠান।\n\nExample: <code>delivery@example.com</code>`
      );
      return res.sendStatus(200);
    }

    if (text && text.includes("@")) {
      const user = await prisma.user.findFirst({
        where: { email: text.toLowerCase().trim(), isDeleted: false },
      });

      if (!user) {
        await sendTelegramMessage(chatId, `❌ এই email দিয়ে কোনো account পাওয়া যায়নি।`);
        return res.sendStatus(200);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
      });

      await sendTelegramMessage(chatId,
        `✅ <b>${user.name}</b>, আপনার account সফলভাবে connect হয়েছে!\n\nএখন থেকে নতুন order assign হলে এখানে notification আসবে। 🛵`
      );
      return res.sendStatus(200);
    }

    await sendTelegramMessage(chatId,
      `আপনার iMall login email পাঠান।\nExample: <code>delivery@example.com</code>`
    );
    return res.sendStatus(200);

  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.sendStatus(200);
  }
};