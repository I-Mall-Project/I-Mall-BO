import { defaultLimit, defaultPage } from "../../utils/defaultData.js";
import deleteFromCloudinary from "../../utils/deleteFromCloudinary.js";
import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";
import slugify from "../../utils/slugify.js";
import uploadToCLoudinary from "../../utils/uploadToCloudinary.js";
import validateInput from "../../utils/validateInput.js";

// controllers/telegram.controller.js
import prisma from "../../utils/prismaClient.js";
import sendTelegramMessage from "../../utils/sendTelegram.js";

// ✅ Delivery man /start পাঠালে chat_id save হবে
export const telegramWebhook = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id.toString();
    const text   = message.text?.trim();

    // /start command — phone number দিয়ে match করব
    if (text?.startsWith("/start")) {
      await sendTelegramMessage(chatId,
        `👋 <b>iMall Delivery Bot</b> এ স্বাগতম!\n\niMall এ login করার <b>email</b> পাঠান।\n\nExample: <code>delivery@example.com</code>`
      );
      return res.sendStatus(200);
    }

    // Email দিলে user খুঁজে chat_id save করব
    if (text && text.includes("@")) {
      const user = await prisma.user.findFirst({
        where: { email: text.toLowerCase().trim(), isDeleted: false },
      });

      if (!user) {
        await sendTelegramMessage(chatId, `❌ এই email দিয়ে কোনো account পাওয়া যায়নি।`);
        return res.sendStatus(200);
      }

      // Chat ID save করো
      await prisma.user.update({
        where: { id: user.id },
        data:  { telegramChatId: chatId },
      });

      await sendTelegramMessage(chatId,
        `✅ <b>${user.name}</b>, আপনার account সফলভাবে connect হয়েছে!\n\nএখন থেকে নতুন order assign হলে এখানে notification আসবে। 🛵`
      );
      return res.sendStatus(200);
    }

    // অন্য message
    await sendTelegramMessage(chatId, `আপনার iMall login email পাঠান।\nExample: <code>delivery@example.com</code>`);
    return res.sendStatus(200);

  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.sendStatus(200);
  }
};