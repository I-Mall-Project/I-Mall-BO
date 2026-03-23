// utils/sendTelegram.js
const TELEGRAM_BOT_TOKEN = "8799190154:AAGxK9HPqjBazBs4LTIM3cU1_f-3Fgpul5k";
const TELEGRAM_API       = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const sendTelegramMessage = async (chatId, message) => {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method:  "POST",
      
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       message,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Telegram error:", data.description);
    return data;
  } catch (error) {
    console.error("Telegram send failed:", error.message);
  }
};

export default sendTelegramMessage;