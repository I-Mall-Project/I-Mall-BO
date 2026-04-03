// controllers/telegram.controller.js

import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";
import sendTelegramMessage from "../../utils/Sendtelegram.js";
import { resolveOffer } from "../../utils/assignRider.js";

const TELEGRAM_BOT_TOKEN = "8799190154:AAGxK9HPqjBazBs4LTIM3cU1_f-3Fgpul5k";

export const telegramWebhook = async (req, res) => {
  try {
    const body = req.body;

    // ✅ Inline button callback (Accept/Reject)
    if (body.callback_query) {
      const { data, from, id: callbackId } = body.callback_query;

      if (data.startsWith("accept_") || data.startsWith("reject_")) {
        const accepted = data.startsWith("accept_");
        const orderId = data.replace("accept_", "").replace("reject_", "");

        const rider = await prisma.user.findFirst({
          where: { telegramChatId: String(from.id) },
        });

        if (rider) {
          resolveOffer(orderId, rider.id, accepted);

          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: callbackId,
                text: accepted ? "✅ Accept হয়েছে!" : "❌ Reject হয়েছে",
              }),
            }
          );
        }
      }

      return res.sendStatus(200);
    }

    // ✅ Regular message
    const { message } = body;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id.toString();
    const text = message.text?.trim();

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