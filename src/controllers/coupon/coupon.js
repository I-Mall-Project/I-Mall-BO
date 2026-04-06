import { defaultLimit, defaultPage } from "../../utils/defaultData.js";
import sendEmail from "../../utils/emailService.js";
import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";
import validateInput from "../../utils/validateInput.js";

// ─── Discount calculate helper ─────────────────────────────
const calculateDiscount = (coupon, orderTotal) => {
  if (coupon.discountType === "flat") {
    return Number(coupon.discountAmount ?? 0);
  }
  if (coupon.discountType === "percent") {
    const pct = (orderTotal * Number(coupon.discountPercent ?? 0)) / 100;
    return coupon.maxDiscount ? Math.min(pct, coupon.maxDiscount) : pct;
  }
  if (coupon.discountType === "free_delivery") {
    return 0; // delivery charge frontend/backend-এ 0 করতে হবে আলাদাভাবে
  }
  return 0;
};

// ─── Coupon validate helper ────────────────────────────────
const validateCoupon = async (coupon, customerPhone, orderTotal) => {
  // Active check
  if (!coupon.isActive) return "Coupon টি active নেই";

  // Expiry check
  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    return "Coupon টির মেয়াদ শেষ হয়ে গেছে";
  }

  // Usage limit check
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return "Coupon টির ব্যবহারের সীমা শেষ হয়ে গেছে";
  }

  // Minimum order check
  if (coupon.orderPriceLimit && orderTotal < coupon.orderPriceLimit) {
    return `কমপক্ষে ৳${coupon.orderPriceLimit} এর order করতে হবে`;
  }

  // Per user limit check
  const userUsageCount = await prisma.couponUsage.count({
    where: { couponId: coupon.id, userPhone: customerPhone },
  });
  if (userUsageCount >= coupon.perUserLimit) {
    return `এই coupon আপনি সর্বোচ্চ ${coupon.perUserLimit} বার ব্যবহার করতে পারবেন`;
  }

  // First order check
  if (coupon.couponType === "first_order") {
    const previousOrders = await prisma.order.count({
      where: { customerPhone },
    });
    if (previousOrders > 0) {
      return "এই coupon শুধু প্রথম order-এ ব্যবহার করা যাবে";
    }
  }

  // Referral check
  if (coupon.couponType === "referral") {
    const usage = await prisma.couponUsage.findFirst({
      where: { couponId: coupon.id, userPhone: customerPhone },
    });
    if (usage) return "এই referral coupon আপনি আগেই ব্যবহার করেছেন";
  }

  // Loyalty check — minimum X orders থাকতে হবে
  if (coupon.couponType === "loyalty") {
    const totalOrders = await prisma.order.count({
      where: { customerPhone },
    });
    if (totalOrders < 3) {
      return "এই coupon পেতে কমপক্ষে ৩টি order করতে হবে";
    }
  }

  return null; // null = valid
};

// ══════════════════════════════════════════════════════════════
// ADMIN CONTROLLERS
// ══════════════════════════════════════════════════════════════

// ─── Create coupon ────────────────────────────────────────
export const createCoupon = async (req, res) => {
  try {
    const {
      code, name, orderPriceLimit,
      discountAmount, discountPercent, maxDiscount,
      discountType, couponType,
      usageLimit, perUserLimit,
      expiresAt, isActive,
    } = req.body;

    const inputValidation = validateInput([code, name], ["Code", "Name"]);
    if (inputValidation) {
      return res.status(400).json(jsonResponse(false, inputValidation, null));
    }

    // Discount type validation
    if (!["flat", "percent", "free_delivery"].includes(discountType || "flat")) {
      return res.status(400).json(jsonResponse(false, "Invalid discount type", null));
    }
    if ((discountType === "flat" || !discountType) && !discountAmount) {
      return res.status(400).json(jsonResponse(false, "Flat discount amount দিন", null));
    }
    if (discountType === "percent" && !discountPercent) {
      return res.status(400).json(jsonResponse(false, "Discount percentage দিন", null));
    }

    const existing = await prisma.coupon.findFirst({ where: { code } });
    if (existing) {
      return res.status(409).json(jsonResponse(false, `${code} already exists`, null));
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code:           code.toUpperCase().trim(),
        name,
        orderPriceLimit: orderPriceLimit ? Number(orderPriceLimit) : null,
        discountAmount:  discountType === "free_delivery" ? 0 : (discountAmount ? Number(discountAmount) : null),
        discountPercent: discountPercent ? Number(discountPercent) : null,
        maxDiscount:     maxDiscount     ? Number(maxDiscount)     : null,
        discountType:    discountType    || "flat",
        couponType:      couponType      || "general",
        usageLimit:      usageLimit      ? Number(usageLimit)      : null,
        perUserLimit:    perUserLimit    ? Number(perUserLimit)     : 1,
        expiresAt:       expiresAt       ? new Date(expiresAt)     : null,
        isActive:        isActive === "true" || isActive === true,
      },
    });

    return res.status(200).json(jsonResponse(true, "Coupon created successfully", newCoupon));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Get all coupons (admin) ──────────────────────────────
export const getCoupons = async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: {
        name: { contains: req.query.name || "", mode: "insensitive" },
      },
      include: { _count: { select: { CouponUsage: true } } },
      orderBy: { createdAt: "desc" },
      skip:  req.query.limit && req.query.page ? parseInt(req.query.limit * (req.query.page - 1)) : parseInt(defaultLimit() * (defaultPage() - 1)),
      take:  req.query.limit ? parseInt(req.query.limit) : parseInt(defaultLimit()),
    });

    if (coupons.length === 0) {
      return res.status(200).json(jsonResponse(true, "No coupon available", null));
    }
    return res.status(200).json(jsonResponse(true, `${coupons.length} coupons found`, coupons));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Get single coupon (admin) ────────────────────────────
export const getCoupon = async (req, res) => {
  try {
    const coupon = await prisma.coupon.findFirst({
      where: { id: req.params.id },
      include: {
        CouponUsage: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { CouponUsage: true } },
      },
    });
    if (!coupon) return res.status(404).json(jsonResponse(false, "Coupon not found", null));
    return res.status(200).json(jsonResponse(true, "Coupon found", coupon));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Update coupon ────────────────────────────────────────
export const updateCoupon = async (req, res) => {
  try {
    const {
      code, name, orderPriceLimit,
      discountAmount, discountPercent, maxDiscount,
      discountType, couponType,
      usageLimit, perUserLimit,
      expiresAt, isActive,
    } = req.body;

    const inputValidation = validateInput([code, name], ["Code", "Name"]);
    if (inputValidation) {
      return res.status(400).json(jsonResponse(false, inputValidation, null));
    }

    const findCoupon = await prisma.coupon.findFirst({ where: { id: req.params.id } });
    if (!findCoupon) return res.status(404).json(jsonResponse(false, "Coupon not found", null));

    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        code:            code.toUpperCase().trim(),
        name,
        orderPriceLimit: orderPriceLimit ? Number(orderPriceLimit) : null,
        // AFTER
discountAmount:  discountType === "free_delivery" ? 0 : (discountAmount ? Number(discountAmount) : null),
          discountPercent: discountPercent ? Number(discountPercent) : null,
        maxDiscount:     maxDiscount     ? Number(maxDiscount)     : null,
        discountType:    discountType    || "flat",
        couponType:      couponType      || "general",
        usageLimit:      usageLimit      ? Number(usageLimit)      : null,
        perUserLimit:    perUserLimit    ? Number(perUserLimit)     : 1,
        expiresAt:       expiresAt       ? new Date(expiresAt)     : null,
        isActive:        isActive === "true" || isActive === true,
      },
    });

    return res.status(200).json(jsonResponse(true, "Coupon updated", coupon));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Delete coupon ────────────────────────────────────────
export const deleteCoupon = async (req, res) => {
  try {
    await prisma.couponUsage.deleteMany({ where: { couponId: req.params.id } });
    const coupon = await prisma.coupon.delete({ where: { id: req.params.id } });
    return res.status(200).json(jsonResponse(true, "Coupon deleted", coupon));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Send coupon email to all subscribers ─────────────────
export const sendCouponEmail = async (req, res) => {
  try {
    const coupon = await prisma.coupon.findFirst({ where: { id: req.params.id } });
    if (!coupon) return res.status(404).json(jsonResponse(false, "Coupon not found", null));

    const emailList = await prisma.newsletter.findMany({ where: { isActive: true } });

    const discountText =
      coupon.discountType === "flat"         ? `৳${coupon.discountAmount} ছাড়` :
      coupon.discountType === "percent"       ? `${coupon.discountPercent}% ছাড়${coupon.maxDiscount ? ` (সর্বোচ্চ ৳${coupon.maxDiscount})` : ""}` :
      coupon.discountType === "free_delivery" ? "ফ্রি ডেলিভারি" : "";

    const minOrder = coupon.orderPriceLimit
      ? `<p>🛒 <b>সর্বনিম্ন order: ৳${coupon.orderPriceLimit}</b></p>`
      : `<p>✅ <b>কোনো minimum order নেই</b></p>`;

    const expiry = coupon.expiresAt
      ? `<p>⏰ <b>Offer শেষ:</b> ${new Date(coupon.expiresAt).toLocaleDateString("en-BD")}</p>`
      : "";

    for (const subscriber of emailList) {
      await sendEmail(
        subscriber.email,
        `🎉 ${coupon.name} — কোড: ${coupon.code}`,
        `
        <h2>${coupon.name}</h2>
        <p>নতুন coupon এসেছে: <b>${coupon.code}</b></p>
        <p>💰 <b>${discountText}</b></p>
        ${minOrder}
        ${expiry}
        <p>Checkout-এ <b>${coupon.code}</b> লিখুন এবং সাশ্রয় করুন!</p>
        <p>👉 <a href="https://imall.com.bd/shop">এখনই কিনুন</a></p>
        <br/><p><b>iMall Team</b></p>
        `
      );
    }

    return res.status(200).json(jsonResponse(true, `Email sent to ${emailList.length} subscribers`, coupon));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ══════════════════════════════════════════════════════════════
// CUSTOMER CONTROLLERS
// ══════════════════════════════════════════════════════════════

// ─── Validate coupon (customer applies coupon at checkout) ─
export const validateCouponForCustomer = async (req, res) => {
  try {
    const { code, customerPhone, orderTotal } = req.body;

    if (!code || !customerPhone || !orderTotal) {
      return res.status(400).json(jsonResponse(false, "code, customerPhone এবং orderTotal দিন", null));
    }

    const coupon = await prisma.coupon.findFirst({
      where: { code: code.toUpperCase().trim(), isActive: true },
    });

    if (!coupon) {
      return res.status(404).json(jsonResponse(false, "Invalid coupon code", null));
    }

    const error = await validateCoupon(coupon, customerPhone, Number(orderTotal));
    if (error) {
      return res.status(400).json(jsonResponse(false, error, null));
    }

    const discountAmount = calculateDiscount(coupon, Number(orderTotal));

    return res.status(200).json(jsonResponse(true, "Coupon applied successfully", {
      couponId:        coupon.id,
      code:            coupon.code,
      name:            coupon.name,
      discountType:    coupon.discountType,
      discountAmount:  Math.round(discountAmount),
      isFreeDelivery:  coupon.discountType === "free_delivery",
    }));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Get all active coupons for customer ──────────────────
export const getCouponsForCustomer = async (req, res) => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        code: { contains: req.query.code || "", mode: "insensitive" },
      },
      select: {
        id: true, code: true, name: true,
        discountType: true, discountAmount: true,
        discountPercent: true, maxDiscount: true,
        orderPriceLimit: true, couponType: true,
        expiresAt: true, usageLimit: true, usageCount: true,
      },
      orderBy: { createdAt: "desc" },
      skip: req.query.limit && req.query.page ? parseInt(req.query.limit * (req.query.page - 1)) : parseInt(defaultLimit() * (defaultPage() - 1)),
      take: req.query.limit ? parseInt(req.query.limit) : parseInt(defaultLimit()),
    });

    if (coupons.length === 0) {
      return res.status(200).json(jsonResponse(true, "No coupon available", []));
    }
    return res.status(200).json(jsonResponse(true, `${coupons.length} coupons found`, coupons));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Get single coupon by code (customer) ─────────────────
export const getCouponForCustomer = async (req, res) => {
  try {
    const coupon = await prisma.coupon.findFirst({
      where: { code: req.params.id.toUpperCase().trim(), isActive: true },
      select: {
        id: true, code: true, name: true,
        discountType: true, discountAmount: true,
        discountPercent: true, maxDiscount: true,
        orderPriceLimit: true, couponType: true, expiresAt: true,
      },
    });

    if (!coupon) return res.status(404).json(jsonResponse(false, "Coupon পাওয়া যায়নি", null));
    return res.status(200).json(jsonResponse(true, "Coupon found", coupon));
  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ─── Record coupon usage (order place হলে call করবে) ──────
// এটা createOrder এর ভেতর থেকে call করুন
export const recordCouponUsage = async (couponId, customerPhone, orderId) => {
  try {
    await prisma.$transaction([
      prisma.couponUsage.create({
        data: { couponId, userPhone: customerPhone, orderId },
      }),
      prisma.coupon.update({
        where: { id: couponId },
        data: { usageCount: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    console.error("Coupon usage record error:", error.message);
  }
};

// ─── Auto generate loyalty coupon ────────────────


// কোনো customer X টা order করলে automatically loyalty coupon তৈরি করে email পাঠায়
export const checkAndSendLoyaltyCoupon = async (customerPhone, customerEmail, customerName) => {
  try {
    const orderCount = await prisma.order.count({ where: { customerPhone } });

    // প্রতি ৫ম order-এ loyalty coupon পাঠাও
    if (orderCount % 5 !== 0) return;

    const code = `LOYAL${customerPhone.slice(-4)}${orderCount}`;

    // আগে এই code দিয়ে coupon আছে কিনা দেখো
    const existing = await prisma.coupon.findFirst({ where: { code } });
    if (existing) return;

    const coupon = await prisma.coupon.create({
      data: {
        code,
        name:          `Loyalty Reward — ${orderCount} orders!`,
        discountType:  "flat",
        discountAmount: 50,
        couponType:    "loyalty",
        perUserLimit:  1,
        usageLimit:    1,
        expiresAt:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 দিন
        isActive:      true,
      },
    });

    if (customerEmail) {
      await sendEmail(
        customerEmail,
        `🎁 ${customerName}, আপনার loyalty reward এসেছে!`,
        `
        <h2>ধন্যবাদ ${customerName}! 🎉</h2>
        <p>আপনি iMall-এ ${orderCount}টি order সম্পন্ন করেছেন।</p>
        <p>আপনার জন্য বিশেষ উপহার:</p>
        <h3>Coupon Code: <b>${coupon.code}</b></h3>
        <p>💰 <b>৳50 ছাড়</b> পরবর্তী যেকোনো order-এ</p>
        <p>⏰ মেয়াদ: ৩০ দিন</p>
        <p>👉 <a href="https://imall.com.bd/shop">এখনই ব্যবহার করুন</a></p>
        <br/><p><b>iMall Team</b></p>
        `
      );
    }
  } catch (error) {
    console.error("Loyalty coupon error:", error.message);
  }
};