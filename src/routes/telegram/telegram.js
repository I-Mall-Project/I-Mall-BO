// routes/telegram.routes.js
import express from "express";
import { telegramWebhook } from "../../controllers/telegram.js";

const router = express.Router();

// Telegram webhook — POST request আসবে Telegram থেকে
router.post("/v1/telegram/webhook", telegramWebhook);

export default router;