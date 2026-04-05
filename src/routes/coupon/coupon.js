import express from "express";
import {
  createCoupon,
  deleteCoupon,
  getCoupon,
  getCouponForCustomer,
  getCoupons,
  getCouponsForCustomer,
  sendCouponEmail,
  updateCoupon,
  validateCouponForCustomer,
} from "../../controllers/coupon/coupon.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();

// ── Admin routes ──────────────────────────────────────────
router.post("/v1/coupons",           verify, createCoupon);
router.get("/v1/coupons",            verify, getCoupons);
router.get("/v1/coupons/:id",        verify, getCoupon);
router.put("/v1/coupons/:id",        verify, updateCoupon);
router.delete("/v1/coupons/:id",     verify, deleteCoupon);
router.get("/v1/coupons-email/:id",  verify, sendCouponEmail);

// ── Customer routes ───────────────────────────────────────
router.get("/v1/customer/coupons",      getCouponsForCustomer);
router.get("/v1/customer/coupons/:id",  getCouponForCustomer);

// ✅ Coupon validate — checkout এ apply করলে call হবে
router.post("/v1/customer/coupons/validate", validateCouponForCustomer);

export default router;