import express from "express";
import {
  loginWithOtp,
  logout,
  register,
  sendLoginOtp,
  login
} from "../../controllers/auth/auth.js";
import { usersCreate } from "../../utils/modules.js";
import verify from "../../utils/verifyToken.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// router.post("/v1/auth/register", usersCreate, verify, register);

router.post("/v1/auth/register", upload.fields([
  { name: "nidAttachment", maxCount: 2 },
  { name: "passportPhoto", maxCount: 1 }
]), register);

router.post("/v1/auth/login", login);

router.post("/v1/auth/send-login-otp", sendLoginOtp);
router.post("/v1/auth/login-with-otp", loginWithOtp);
router.post("/v1/auth/logout", logout);

//For customer
router.post("/v1/customer/auth/register", register);

export default router;
