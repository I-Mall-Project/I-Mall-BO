import express from "express";
import { telegramWebhook } from "../../controllers/telegram/telegram.js";

const router = express.Router();

router.post("/v1/telegram/webhook", telegramWebhook);

export default router;