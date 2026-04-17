// import pkg from "sslcommerz-lts";
// import dotenv from "dotenv";
import axios from "axios";
import SSLCommerzPayment from "sslcommerz-lts";
import { defaultLimit, defaultPage } from "../../utils/defaultData.js";
// import sendEmail from "../../utils/emailService.js";
import jsonResponse from "../../utils/jsonResponse.js";
import prisma from "../../utils/prismaClient.js";
import validateInput from "../../utils/validateInput.js";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import striptags from "striptags";


import nodemailer from "nodemailer";
import sendTelegramMessage from "../../utils/Sendtelegram.js";
import { autoAssignRider } from "../../utils/assignRider.js";
import { calculateDeliveryCharge } from "../../utils/Deliverycharge.js";
import { generateInvoiceNumber } from "../../utils/generateInvoiceNumber.js";
import { checkAndSendLoyaltyCoupon, recordCouponUsage } from "../coupon/coupon.js";



// dotenv.config();

const module_name = "order";

// const store_id = "tronl691b042c73761";
// const store_passwd = "tronl691b042c73761@ssl";
// const is_live = true; //true for live, false for sandbox

// const store_id = "tronlineraipur0live";
// const store_passwd = "68ED5E1FD3A0C97770";
// const is_live = true; //true for live, false for sandbox



//create order


const GMAIL_ID = process.env.GMAIL_ID;
const GMAIL_PASS = process.env.GMAIL_PASS;

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_ID,
      pass: GMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"iMall" <${GMAIL_ID}>`,
    to,
    subject,
    html,
  });
};


export const getDeliveryCharge = async (req, res) => {
  const { customerLat, customerLng,productId  } = req.body;

    console.log("📦 delivery-charge hit:", { customerLat, customerLng, productId });

 
 
  if (!customerLat || !customerLng) {
    return res.json({ charge: 30, distanceKm: 0, eta: null });
  }
 
  // ✅ Brand এর location DB থেকে নাও
  // ✅ productId দিয়ে brand এর lat/lng বের করো
  const product = productId
    ? await prisma.product.findFirst({
        where: { id: productId },
        include: { brand: { select: { lat: true, lng: true } } },
      })
    : null;

  const SHOP_LAT = product?.brand?.lat ?? null;
  const SHOP_LNG = product?.brand?.lng ?? null;

    console.log("📍 SHOP_LAT:", SHOP_LAT, "SHOP_LNG:", SHOP_LNG);

 
  // Brand location না থাকলে default charge return করো
  if (!SHOP_LAT || !SHOP_LNG) {
    return res.json({ charge: 30, distanceKm: 0, eta: null });
  }
 
  const route = await getRouteETA(
    SHOP_LAT,
    SHOP_LNG,
    parseFloat(customerLat),
    parseFloat(customerLng)
  );
 
  const distanceKm = route?.distanceKm ?? 0;
  const charge     = calculateDeliveryCharge(distanceKm);
 
  return res.json({
    charge,
    distanceKm,
    eta:     route?.label   ?? null,
    minutes: route?.minutes ?? null,
  });
};

/**
 * createOrder.js
 * --------------
 * Brand DB থেকে shop location নিয়ে delivery charge auto-calculate করা হয়।
 *
 * পরিবর্তন কী হয়েছে:
 *   1. deliveryChargeInside / Outside frontend থেকে আর পাঠাতে হবে না
 *   2. product এর brand.lat / brand.lng দিয়ে ORS road distance বের হয়
 *   3. calculateDeliveryCharge(km) দিয়ে charge বসে
 *   4. বাকি সব আগের মতোই আছে
 */


export const createOrder = async (req, res) => {
  try {
    const {
      userId,
      couponId,
      customerName,
      customerPhone,
      customerAddress,
      customerBillingAddress,
      customerEmail,
      customerCity,
      customerPostalCode,
      paymentMethod,
      platformCharge,
      customerLat,
      customerLng,
      orderItems,
        orderType,      // ← নতুন field

    } = req.body;

    const inputValidation = validateInput(
      [customerName, customerPhone, customerAddress, paymentMethod],
      ["Name", "Phone", "Shipping Address", "Payment Method"]
    );

    if (inputValidation) {
      return res.status(400).json(jsonResponse(false, inputValidation, null));
    }

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json(jsonResponse(false, "Please select at least 1 item", null));
    }

    // ----------------------------------------------------------------
    // 1. Product info + Brand location DB থেকে নাও
    // ----------------------------------------------------------------
    const firstItem = orderItems?.[0];

    const productInfo = await prisma.product.findFirst({
      where: { id: firstItem.productId, isDeleted: false, isActive: true },
      include: { brand: true },
    });

    if (!productInfo) {
      return res.status(400).json(jsonResponse(false, "Product not found", null));
    }

    // ----------------------------------------------------------------
    // 2. Delivery charge — brand DB location থেকে customer পর্যন্ত
    // ----------------------------------------------------------------
    const SHOP_LAT = productInfo?.brand?.lat ?? null;
    const SHOP_LNG = productInfo?.brand?.lng ?? null;

    // createOrder এ এই check যোগ করুন:
const isOfflineSale = orderType === "OFFLINE";

let deliveryCharge = isOfflineSale ? 0 : 30;  // offline এ ০
let deliveryDistanceKm = 0;


    if (!isOfflineSale && customerLat && customerLng && SHOP_LAT && SHOP_LNG) {
      const route = await getRouteETA(
        SHOP_LAT, SHOP_LNG,
        parseFloat(customerLat), parseFloat(customerLng)
      );
      if (route?.distanceKm) {
        deliveryDistanceKm = route.distanceKm;
        deliveryCharge     = calculateDeliveryCharge(route.distanceKm);
      }
    }

    // ----------------------------------------------------------------
    // 3. Invoice number
    // ----------------------------------------------------------------
    const invoiceNumber = await generateInvoiceNumber(
      prisma,
      productInfo.brand?.brandID || "00",
      productInfo.productCode    || "0000"
    );

    // ----------------------------------------------------------------
    // 4. Transaction — order create
    // ----------------------------------------------------------------
    const newOrder = await prisma.$transaction(async (tx) => {
      let totalItems    = 0;
      let subtotal      = 0;
      let subtotalCost  = 0;
      let newOrderItems = [];

      for (const item of orderItems) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, isDeleted: false, isActive: true },
          include: { brand: true },
        });

        const productAttribute = await tx.productAttribute.findFirst({
          where: { id: item.productAttributeId, isDeleted: false },
        });

        if (!product || !productAttribute) {
          throw new Error("Product or attribute does not exist");
        }

        const totalPrice     = item.quantity * productAttribute.discountedRetailPrice;
        const totalCostPrice = item.quantity * productAttribute.costPrice;

        newOrderItems.push({
          productId:             item.productId,
          productCode:           product.productCode || null,
          barcode:               product.barcode     || null,
          brandId:               product.brandId     || null,
          brandName:             product.brand?.name || null,
          productAttributeId:    item.productAttributeId,
          name:                  product.name,
          size:                  productAttribute.size,
          costPrice:             productAttribute.costPrice,
          retailPrice:           productAttribute.retailPrice,
          discountPercent:       productAttribute.discountPercent,
          discountPrice:         productAttribute.discountPrice,
          discountedRetailPrice: productAttribute.discountedRetailPrice,
          totalCostPrice,
          totalPrice,
          quantity:              item.quantity,
        });

        totalItems   += item.quantity;
        subtotal     += totalPrice;
        subtotalCost += totalCostPrice;
      }

      // ✅ Coupon — advanced discount calculate
      let couponDiscountAmount = 0;
      let isFreeDelivery       = false;

      const coupon = couponId
        ? await tx.coupon.findFirst({ where: { id: couponId, isActive: true } })
        : null;

      if (coupon) {
        if (coupon.discountType === "flat") {
          couponDiscountAmount = Number(coupon.discountAmount ?? 0);
        } else if (coupon.discountType === "percent") {
          const pct = (subtotal * Number(coupon.discountPercent ?? 0)) / 100;
          couponDiscountAmount = coupon.maxDiscount
            ? Math.min(pct, coupon.maxDiscount)
            : pct;
        } else if (coupon.discountType === "free_delivery") {
          isFreeDelivery       = true;
          couponDiscountAmount  = deliveryCharge; // delivery charge টাই discount হবে
        }
      }

      // Free delivery হলে charge 0
      const finalDeliveryCharge = isFreeDelivery ? 0 : deliveryCharge;
      const safePlatformCharge  = Number(platformCharge) || 0;



      const finalSubtotal =
        subtotal +
        finalDeliveryCharge +
        safePlatformCharge -
        Math.round(couponDiscountAmount);

      const order = await tx.order.create({
        data: {
          userId,
          couponId,
          customerName,
          customerPhone,
          customerAddress,
          customerBillingAddress,
          customerEmail,
          customerCity,
          customerPostalCode,
          customerLat:           customerLat ? parseFloat(customerLat) : null,
          customerLng:           customerLng ? parseFloat(customerLng) : null,
          invoiceNumber,
          totalItems,
          subtotalCost,
          subtotal:              finalSubtotal,
          paymentMethod,
          deliveryChargeInside:  finalDeliveryCharge,
          deliveryChargeOutside: null,
          platformCharge:        safePlatformCharge,
          orderItems: { create: newOrderItems },
          orderType, // ← নতুন field
        },
        include: { orderItems: true },
      });

      for (const item of orderItems) {
        await tx.productAttribute.update({
          where: { id: item.productAttributeId },
          data: { stockAmount: { decrement: item.quantity } },
        });
      }

      return order;
    });

    // ----------------------------------------------------------------
    // 5. Coupon usage record + Loyalty check
    // ----------------------------------------------------------------
    if (couponId) {
      await recordCouponUsage(couponId, customerPhone, newOrder.id);
    }

    // প্রতি ৫ম order-এ loyalty coupon auto generate + email
    checkAndSendLoyaltyCoupon(customerPhone, customerEmail, customerName).catch(console.error);

    // ----------------------------------------------------------------
    // 6. Email
    // ----------------------------------------------------------------
    const orderTime         = new Date();
    const estimatedDelivery = new Date(orderTime.getTime() + 40 * 60 * 1000);

    const formatTime = (date) =>
      date.toLocaleTimeString("en-BD", {
        hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka",
      });

    const deliveryLabel = `Inside Dhaka (${deliveryDistanceKm} km)`;

    const emailBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f0ece8;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece8;padding:30px 0;">
  <tr>
    <td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.07);font-family:'Segoe UI',Arial,sans-serif;">
        <tr>
          <td style="background:linear-gradient(135deg,#c8773a,#b5622c);padding:28px 30px;text-align:center;">
            <h1 style="margin:0;font-size:36px;font-weight:900;color:#ffffff;letter-spacing:2px;">iMall</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.82);font-size:13px;">Genuine Products · Express Delivery</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fdf6f0;padding:20px 30px;text-align:center;border-bottom:1px solid #e8d5c8;">
            <span style="display:inline-block;background:linear-gradient(135deg,#c8773a,#b5622c);color:#fff;font-size:13px;font-weight:700;padding:6px 20px;border-radius:30px;letter-spacing:1px;">✔ ORDER CONFIRMED</span>
          </td>
        </tr>
        <tr>
          <td style="padding:30px;">
            <p style="font-size:16px;color:#333;margin:0 0 6px;">Dear <strong style="color:#c8773a;">${customerName}</strong>,</p>
            <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px;">Thank you for shopping with <strong style="color:#c8773a;">iMall</strong>. Your order has been successfully placed.</p>
            <p style="font-size:13px;font-weight:700;color:#c8773a;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Ordered Items</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8d5c8;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
              <thead>
                <tr style="background:linear-gradient(135deg,#c8773a,#b5622c);">
                  <th style="padding:10px 14px;color:#fff;text-align:left;font-weight:600;">Product</th>
                  <th style="padding:10px 14px;color:#fff;text-align:center;font-weight:600;">Size</th>
                  <th style="padding:10px 14px;color:#fff;text-align:center;font-weight:600;">Qty</th>
                  <th style="padding:10px 14px;color:#fff;text-align:right;font-weight:600;">Unit Price</th>
                </tr>
              </thead>
              <tbody>
                ${newOrder.orderItems.map((item, index) => `
                  <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fdf6f0"};">
                    <td style="padding:10px 14px;color:#333;">${item.name}</td>
                    <td style="padding:10px 14px;color:#555;text-align:center;">${item.size || "—"}</td>
                    <td style="padding:10px 14px;color:#555;text-align:center;">${item.quantity}</td>
                    <td style="padding:10px 14px;color:#c8773a;font-weight:600;text-align:right;">${item.discountedRetailPrice} TK</td>
                  </tr>`).join("")}
              </tbody>
            </table>
            <p style="font-size:13px;font-weight:700;color:#c8773a;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Order Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6f0;border:1px solid #e8d5c8;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
              <tr><td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Invoice No</td><td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">#${invoiceNumber}</td></tr>
              <tr><td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Delivery Address</td><td style="padding:10px 16px;color:#333;text-align:right;border-bottom:1px solid #e8d5c8;">${customerAddress}${customerCity ? `, ${customerCity}` : ""}</td></tr>
              <tr><td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Total Items</td><td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">${newOrder.totalItems}</td></tr>
              <tr><td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Payment Method</td><td style="padding:10px 16px;color:#333;text-align:right;border-bottom:1px solid #e8d5c8;">${paymentMethod}</td></tr>
              <tr><td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Delivery Charge <span style="font-size:11px;color:#fff;background:#c8773a;padding:2px 8px;border-radius:10px;margin-left:6px;font-weight:600;">${deliveryLabel}</span></td><td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">${deliveryCharge} TK</td></tr>
              <tr><td style="padding:12px 16px;color:#333;font-weight:700;font-size:15px;">Total Amount</td><td style="padding:12px 16px;color:#c8773a;font-weight:800;font-size:16px;text-align:right;">${newOrder.subtotal} TK</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#c8773a,#b5622c);border-radius:12px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <td style="padding:22px;text-align:center;color:#fff;">
                  <div style="font-size:36px;margin-bottom:8px;">⏰</div>
                  <p style="margin:0;font-size:15px;font-weight:700;">Express Delivery — 30 to 40 Minutes</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                    <tr>
                      <td style="text-align:center;width:50%;padding:0 8px;">
                        <p style="margin:0;font-size:12px;opacity:0.85;text-transform:uppercase;">Order Placed At</p>
                        <p style="margin:6px 0 0;font-size:18px;font-weight:700;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:20px;display:inline-block;">${formatTime(orderTime)}</p>
                      </td>
                      <td style="text-align:center;width:50%;padding:0 8px;border-left:1px solid rgba(255,255,255,0.3);">
                        <p style="margin:0;font-size:12px;opacity:0.85;text-transform:uppercase;">Estimated Arrival</p>
                        <p style="margin:6px 0 0;font-size:18px;font-weight:700;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:20px;display:inline-block;">${formatTime(estimatedDelivery)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="background:#fdf6f0;border:1px solid #e8d5c8;border-radius:10px;padding:14px 18px;font-size:13px;color:#666;line-height:1.7;">
              <strong style="color:#c8773a;">Need help?</strong>
              Contact us at <a href="tel:01748399860" style="color:#c8773a;text-decoration:none;font-weight:600;">01748399860</a>
              or email <a href="mailto:support@imall.com" style="color:#c8773a;text-decoration:none;font-weight:600;">support@imall.com</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#fdf6f0;border-top:1px solid #e8d5c8;padding:20px 30px;text-align:center;">
            <p style="margin:0;font-size:15px;font-weight:800;color:#c8773a;">iMall</p>
            <p style="margin:6px 0 0;font-size:12px;color:#999;line-height:1.8;">
              📍 Level 4, AQP Shopping Mall, Bailey Road, Ramna, Dhaka-1000<br/>
              📞 01748399860 &nbsp;·&nbsp; ✉️ support@imall.com
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#bbb;">© ${new Date().getFullYear()} iMall. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    if (customerEmail) {
      await sendEmail(customerEmail, `Order Placed from I-Mall — Invoice #${invoiceNumber}`, emailBody);
    }
    await sendEmail("shamimrocky801@yahoo.com", `New Order Received — Invoice #${invoiceNumber}`, emailBody);

    autoAssignRider(prisma, newOrder, sendTelegramMessage).catch(console.error);

    return res.status(200).json(jsonResponse(true, "Your order has been placed successfully", newOrder));

  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message || error, null));
  }
};

//create order ssl
export const createOrderSsl = async (req, res) => {
  const {
    userId,
    couponId,
    customerName,
    customerPhone,
    customerAddress,
    customerBillingAddress,
    customerEmail,
    customerCity,
    customerPostalCode,
    invoiceNumber,
    paymentMethod,
    deliveryChargeInside,
    deliveryChargeOutside,
    // totalItems,
    // subtotalCost,
    // subtotal,
    orderItems,
  } = req.body;

  //count total items and subtotal price for order and get name,size,prices info
  let totalNumberOfItems = 0;
  let subtotal = 0;
  let subtotalCost = 0;
  let newOrderItems = [];
  let allProductNames = "";

  if (orderItems && orderItems.length > 0) {
    const orderItemLength = orderItems.length;
    for (let i = 0; i < orderItemLength; i++) {
      //get product and product attribute for getting prices,name,size info
      const product = await prisma.product.findFirst({
        where: {
          id: orderItems[i].productId,
          isDeleted: false,
          isActive: true,
        },
      });
      const productAttribute = await prisma.productAttribute.findFirst({
        where: { id: orderItems[i].productAttributeId, isDeleted: false },
      });

      if (!product && !productAttribute) {
        return res
          .status(409)
          .json(jsonResponse(false, "Product does not exist", null));
      }

      newOrderItems.push({
        ...orderItems[i],
        name: product.name,
        size: productAttribute.size,
        costPrice: productAttribute.costPrice,
        retailPrice: productAttribute.retailPrice,
        discountPercent: productAttribute.discountPercent,
        discountPrice: productAttribute.discountPrice,
        discountedRetailPrice: productAttribute.discountedRetailPrice,
        totalCostPrice: orderItems[i].quantity * productAttribute.costPrice,
        totalPrice:
          orderItems[i].quantity * productAttribute.discountedRetailPrice,
        quantity: orderItems[i].quantity,
      });

      //calculate total number of items
      totalNumberOfItems = totalNumberOfItems + orderItems[i].quantity;

      //calculate discount prices
      let discountPrice =
        productAttribute.retailPrice * (productAttribute.discountPercent / 100);
      let discountedRetailPrice =
        (productAttribute.retailPrice - discountPrice) * orderItems[i].quantity;

      //calculate subtotal and subtotal cost price
      subtotal = subtotal + orderItems[i]?.totalPrice;
      subtotalCost = subtotalCost + orderItems[i]?.totalCostPrice;
      // subtotal = subtotal + discountedRetailPrice;
      // subtotalCost =
      //   subtotalCost + orderItems[i].quantity * productAttribute.costPrice;

      allProductNames = allProductNames + ", " + orderItems[i]?.name;
    }
  } else {
    return res
      .status(404)
      .json(jsonResponse(false, "Please select at least 1 item", null));
  }

  //get coupon
  let coupon = couponId
    ? await prisma.coupon.findFirst({
        where: { id: couponId, isActive: true },
      })
    : undefined;

  //ssl commerz
  if (paymentMethod?.toLowerCase() === "digital payment") {
    const data = {
      total_amount:
        subtotal + deliveryChargeInside - (coupon?.discountAmount ?? 0),
      currency: "BDT",
      tran_id: invoiceNumber, // use unique tran_id for each api call
      // success_url: "http://localhost:8000/api/v1/orders-success",
      // fail_url: "http://localhost:8000/api/v1/orders-fail",
      // cancel_url: "http://localhost:8000/api/v1/orders-fail",
      success_url: "https://isp-core.vercel.app/api/v1/orders-success",
      fail_url: "https://isp-core.vercel.app/api/v1/orders-fail",
      cancel_url: "https://isp-core.vercel.app/api/v1/orders-fail",
      ipn_url: "http://localhost:3000/ipn/",
      shipping_method: "Courier",
      product_name: allProductNames,
      product_category: "Product",
      product_profile: "general",
      cus_name: customerName,
      cus_email: customerEmail,
      cus_add1: customerBillingAddress,
      cus_add2: "",
      cus_city: customerCity,
      cus_state: customerCity,
      cus_postcode: customerPostalCode,
      cus_country: "Bangladesh",
      cus_phone: customerPhone,
      cus_fax: "",
      ship_name: customerName,
      ship_add1: customerAddress,
      ship_add2: "",
      ship_city: customerCity,
      ship_state: customerCity,
      ship_postcode:1000,
      ship_country: "Bangladesh",
    };
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    await sslcz.init(data).then((apiResponse) => {
      console.log("Full API Response:", apiResponse); // Debugging API response

      if (!apiResponse || !apiResponse.GatewayPageURL) {
        return res.status(400).json(
          jsonResponse(false, "Failed to get Gateway URL", {
            error: apiResponse,
          })
        );
      }

      let GatewayPageURL = apiResponse.GatewayPageURL;
      console.log("Redirecting to:", GatewayPageURL);

      // ✅ Ensure only ONE response is sent
      if (!res.headersSent) {
        return res.status(200).json(
          jsonResponse(true, "Redirecting to SSL COMMERZ.", {
            gateway: GatewayPageURL,
          })
        );
      }
    });
    // return;
  }
};


export const getInvoiceData = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        orderItems: true,
        coupon:     true,
      },
    });

    if (!order) {
      return res.status(404).json(jsonResponse(false, "Order not found", null));
    }

    return res.status(200).json(jsonResponse(true, "Invoice data fetched", {
      invoiceNumber:      order.invoiceNumber,
      createdAt:          order.createdAt,
      status:             order.status,

      customerName:       order.customerName,
      customerPhone:      order.customerPhone,
      customerEmail:      order.customerEmail,
      customerAddress:    order.customerAddress,
      customerCity:       order.customerCity,
      customerPostalCode: order.customerPostalCode,

      paymentMethod:      order.paymentMethod,

      deliveryCharge:     order.deliveryChargeInside ?? order.deliveryChargeOutside ?? 0,
      platformCharge:     order.platformCharge       ?? 0,
      couponDiscount:     order.coupon?.discountAmount ?? 0,
      subtotal:           order.subtotal,

      orderItems: order.orderItems.map((item) => ({
        name:                  item.name,
        brandName:             item.brandName,
        barcode:               item.barcode,
        productCode:           item.productCode,
        size:                  item.size,
        quantity:              item.quantity,
        retailPrice:           item.retailPrice,
        discountedRetailPrice: item.discountedRetailPrice,
        totalPrice:            item.totalPrice,
      })),
    }));

  } catch (error) {
    console.error(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};






export const createOrderSuccess = async (req, res) => {
  console.log("Success body:", req.body, req.query);
  res.redirect("https://tronlineraipur.com/checkout?isSuccess=true");
};

export const createOrderFail = async (req, res) => {
  console.log("Fail body:", req.body, req.query);
  res.redirect("https://tronlineraipur.com/checkout?isSuccess=false");
};

//get orders ssl
export const getOrdersSsl = async (req, res) => {
  try {
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

// get all orders
export const getOrders = async (req, res) => {
  if (req.user.roleName !== "super-admin") {
    return getOrdersByUser(req, res);
  } else {
    try {
      const orders = await prisma.order.findMany({
        where: {
          isDeleted: false,
        },
        include: {
          orderItems: {
            include: {
              product: {
                include: {
                  images: true,
                },
              },
            },
          },
          // ✅ Delivery man info include
          User_Order_deliveryManIdToUser: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip:
          req.query.limit && req.query.page
            ? parseInt(req.query.limit * (req.query.page - 1))
            : parseInt(defaultLimit() * (defaultPage() - 1)),
        take: req.query.limit
          ? parseInt(req.query.limit)
          : parseInt(defaultLimit()),
      });
 
      if (!orders || orders.length === 0) {
        return res
          .status(200)
          .json(jsonResponse(true, "No order is available", null));
      }
 
      // ✅ Map orders — image + delivery man name flatten করা
      const ordersWithImages = orders.map((order) => ({
        ...order,
        orderItems: order.orderItems.map((item) => ({
          ...item,
          image: item.product?.images?.length > 0 ? item.product.images[0].image : null,
        })),
        // ✅ Delivery man flat fields
        deliveryManName:  order.User_Order_deliveryManIdToUser?.name  || null,
        deliveryManPhone: order.User_Order_deliveryManIdToUser?.phone || null,
      }));
 
      return res.status(200).json(
        jsonResponse(true, `${ordersWithImages.length} orders found`, ordersWithImages)
      );
    } catch (error) {
      console.log(error);
      return res.status(500).json(jsonResponse(false, "Something went wrong. Try again", null));
    }
  }
};



//get all orders by user
export const getOrdersByUser = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        userId: req.params.id,
        isDeleted: false,
        // AND: [
        //   {
        //     customerName: {
        //       contains: req.query.customer_name,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     customerPhone: {
        //       contains: req.query.customer_phone,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     customerAddress: {
        //       contains: req.query.customer_address,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     customerCity: {
        //       contains: req.query.customer_city,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     customerPostalCode: {
        //       contains: req.query.customer_postal_code,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     invoiceNumber: {
        //       contains: req.query.invoice_number,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     paymentMethod: {
        //       contains: req.query.payment_method,
        //       mode: "insensitive",
        //     },
        //   },
        //   {
        //     status: {
        //       contains: req.query.status,
        //       mode: "insensitive",
        //     },
        //   },
        // ],
      },
      include: {
        orderItems: true,
      },

      orderBy: {
        createdAt: "desc",
      },
      skip:
        req.query.limit && req.query.page
          ? parseInt(req.query.limit * (req.query.page - 1))
          : parseInt(defaultLimit() * (defaultPage() - 1)),
      take: req.query.limit
        ? parseInt(req.query.limit)
        : parseInt(defaultLimit()),
    });

    if (orders.length === 0)
      return res
        .status(200)
        .json(jsonResponse(true, "No order is available", null));

    if (orders) {
      return res
        .status(200)
        .json(jsonResponse(true, `${orders.length} orders found`, orders));
    } else {
      return res
        .status(404)
        .json(jsonResponse(false, "Something went wrong. Try again", null));
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};

//get single order
export const getOrder = async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, isDeleted: false },
      include: {
        orderItems: true,
      },
    });

    if (order) {
      return res.status(200).json(jsonResponse(true, `1 order found`, order));
    } else {
      return res
        .status(404)
        .json(jsonResponse(false, "No order is available", null));
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};



export const verifyPayment = async (req, res) => {
  const { invoice_number } = req.body;
  if (!invoice_number) {
    return res.status(400).json({ success: false, message: "Invoice number required" });
  }

  try {
    const response = await axios.post(
      "https://api.paystation.com.bd/transaction-status",
      { invoice_number },
      { headers: { merchantId: "1720-1759859516" }, timeout: 15000 }
    );

    const data = response.data;
    console.log("💳 PayStation Response:", data);

    if (data.status?.toLowerCase() === "success" && data.data?.trx_status?.toLowerCase() === "successful") {
      const order = await prisma.order.findFirst({ where: { invoiceNumber: invoice_number } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });

      await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
      console.log(`✅ Order ${order.id} marked as DELIVERED`);

      // 🔹 Send mail **awaited** so frontend sees correct status immediately
      await sendOrderMail(order);

      return res.status(200).json({
        success: true,
        invoice_number,
        message: `Payment verified and order ${invoice_number} is confirmed.`,
      });
    }

    return res.status(400).json({ success: false, message: "Payment is processing...", response: data });
  } catch (err) {
    console.error("Verify payment :", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



// 🔸 Async email sending (non-blocking)
const sendOrderMail = async (order) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_ID,
      pass: process.env.GMAIL_PASS,
    },
  });

  const orderItems = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: { product: true },
  });

  const productListHtml = orderItems
    .map((item) => {
      const url = item.driveUrl || item.product?.driveUrl || "#";
      const description = item.product?.shortDescription || "";
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${item.size || "Lifetime"}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${description}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">
            <a href="${url}" target="_blank" style="background:#007BFF;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;">Download</a>
          </td>
        </tr>`;
    })
    .join("");

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;background:#f7f9fc;padding:20px;border-radius:10px;">
      <h2>Hello ${order.customerName},</h2>
      <p>Your digital products are now available for download!</p>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <thead>
          <tr style="background:#007BFF;color:white;">
            <th>Product</th>
            <th>Validity</th>
            <th>Description</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>${productListHtml}</tbody>
      </table>
      <p>Thank you for shopping with <b>File Box</b> 💙</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"File Box" <${process.env.GMAIL_ID}>`,
    to: order.customerEmail,
    subject: `🎉 Your Order ${order.invoiceNumber} is Delivered`,
    html: htmlContent,
  });

  console.log(`📩 Email sent to ${order.customerEmail}`);
};

export const updateOrder = async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  console.log(`updateOrder called for orderId: ${orderId} with status: ${status}`);

  try {
    // 🔹 Fetch order
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 🔹 Fetch order items
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });

    // 🔹 Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    console.log(`✅ Order status updated for ${orderId}`);

    // 🔹 Handle stock if canceled/returned
    if (["CANCELED", "RETURNED"].includes(status)) {
      for (let item of orderItems) {
        await prisma.productAttribute.update({
          where: { id: item.productAttributeId },
          data: { stockAmount: { increment: item.quantity } },
        });
      }
    }

    // 🔹 Handle delivered: PDF + mail
    if (status === "DELIVERED") {
     console.log(`🔹 Generating PDF for order ${orderId}...`);

const pdfPath = path.join(process.cwd(), `order_${orderId}.pdf`);
const doc = new PDFDocument({ size: "A4", margin: 40 });
const writeStream = fs.createWriteStream(pdfPath);
doc.pipe(writeStream);

// 🆕 Unicode font for Bangla + English
const fontPath = path.join(process.cwd(), "src/utils/fonts", "NotoSansBengali-Regular.ttf");
if (fs.existsSync(fontPath)) {
  doc.registerFont("Unicode", fontPath);
  doc.font("Unicode");
}

// White background
doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");

// Gradient header
const gradient = doc.linearGradient(0, 0, doc.page.width, 70);
gradient.stop(0, "#000000").stop(1, "#ff1a1a");
doc.rect(0, 0, doc.page.width, 70).fill(gradient);

// Header info
doc
  .fillColor("white")
  .fontSize(28)
  .text("File Box", 40, 25)
  .fontSize(12)
  .fillColor("#ff4d4d")
  .text("01646-940772 | contact.filebox@gmail.com", 400, 35, { align: "right" });

doc.moveDown(4);

// Headline for products
doc.fillColor("#333333").fontSize(18).text("Product Details", { underline: true });
doc.moveDown(1);

// Product items as list
orderItems.forEach((item, idx) => {
  const cleanDesc = striptags(item.product?.longDescription || "বিবরণ নেই").replace(/&nbsp;/g, " ");

  // Each product in a subtle box
  const startY = doc.y;
  doc.rect(35, startY, doc.page.width - 70, 80).strokeColor("#cccccc").lineWidth(1).stroke();

  doc.fontSize(13).fillColor("#000").text(`${idx + 1}. ${item.name} (${item.size || "Lifetime"})`, 40, startY + 10, { underline: true });
  doc.moveDown(0.2);
  doc.fontSize(12).fillColor("#333").text(cleanDesc, { width: doc.page.width - 80, align: "justify" });
  doc.moveDown(0.5);

  if (item.driveUrl || item.product?.driveUrl) {
    doc.fillColor("#007BFF").text("Download Link", { link: item.driveUrl || item.product?.driveUrl, underline: true });
  }

  doc.moveDown(1.5);
});

// Footer company box
const footerTop = doc.y + 20;
const footerHeight = 80;
doc.rect(40, footerTop, doc.page.width - 80, footerHeight)
  .fillColor("#f9f9f9")
  .strokeColor("#000000")
  .lineWidth(1)
  .fillAndStroke();

doc.fillColor("#000000").fontSize(12)
  .text("File Box", 50, footerTop + 10)
  .text("01646-940772 | contact.filebox@gmail.com", 50, footerTop + 30)
  .text("GEC, Chattogram, Bangladesh", 50, footerTop + 50)
  .text("Website: https://fileboxbd.com/", 50, footerTop + 70);

doc.end();
await new Promise((resolve) => writeStream.on("finish", resolve));

console.log(`📄 PDF created successfully for order ${orderId}`);

      // ✉️ Send mail
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_ID,
          pass: process.env.GMAIL_PASS,
        },
      });

      const productListHtml = orderItems
        .map((item) => {
          const url = item.driveUrl || item.product?.driveUrl || "#";
          const description = item.product?.shortDescription || "";
          return `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${item.name}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${item.size || "Lifetime"}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${description}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">
                <a href="${url}" target="_blank" style="background:#007BFF;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;">Download</a>
              </td>
            </tr>`;
        })
        .join("");

      const mailOptions = {
        from: `"File Box" <${process.env.GMAIL_ID}>`,
        to: updatedOrder.customerEmail,
        subject: `🎉 Your Order ${updatedOrder.invoiceNumber} is Delivered`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#f7f9fc;padding:20px;border-radius:10px;">
            <h2 style="color:#333;">Hello ${updatedOrder.customerName},</h2>
            <p>Your digital products are now available for download!</p>
            <table style="width:100%;border-collapse:collapse;margin-top:10px;">
              <thead>
                <tr style="background:#007BFF;color:white;">
                  <th>Product</th>
                  <th>Validity</th>
                  <th>Description</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>${productListHtml}</tbody>
            </table>
            <p style="margin-top:20px;">Thank you for shopping with <b>File Box</b> 💙</p>
          </div>
        `,
        attachments: [
          {
            filename: `Order_${updatedOrder.invoiceNumber}.pdf`,
            path: pdfPath,
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Mail sent successfully to ${updatedOrder.customerEmail}`);

      // Cleanup
      fs.unlink(pdfPath, (err) => {
        if (err) console.error("❌ Failed to delete temp PDF:", err);
        else console.log("🧹 Temp PDF deleted.");
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
    });
  } catch (error) {
    console.error("❌ Failed to update order or send mail:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const paymentCallback = async (req, res) => {
  const { invoice_number } = req.body; // From PayStation callback

  try {
    // 🔹 Check transaction status via PayStation API
    const response = await axios.post(
      "https://api.paystation.com.bd/transaction-status",
      { invoice_number },
      { headers: { merchantId: "1720-1759859516" } }
    );

    const data = response.data.data;
    if (response.data.status_code !== "200" || !data) {
      return res.status(400).json({ success: false, message: "Transaction not found" });
    }

    // 🔹 If payment successful (you can check trx_status or payment_amount)
    if (data.trx_status === "success") {
      // Find the order
      const order = await prisma.order.findUnique({ where: { invoiceNumber: invoice_number } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });

      // 🔹 Update order to DELIVERED automatically
      await updateOrderStatusDelivered(order.id);

      return res.status(200).json({ success: true, message: "Order marked as DELIVERED" });
    }

    return res.status(400).json({ success: false, message: "Payment not completed yet" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const updateOrderStatusDelivered = async (orderId) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    include: { product: true },
  });

  // Update status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: "DELIVERED" },
  });

  // Generate PDF
  const pdfPath = path.join(process.cwd(), `order_${orderId}.pdf`);
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // Font
  const fontPath = path.join(process.cwd(), "src/utils/fonts/NotoSansBengali-Regular.ttf");
  if (fs.existsSync(fontPath)) doc.registerFont("Unicode", fontPath).font("Unicode");

  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
  doc.fillColor("#000").fontSize(24).text("File Box", { align: "left" });
  doc.fillColor("#ff4d4d").fontSize(12).text("01646-940772 | contact.filebox@gmail.com", { align: "right" });
  doc.moveDown(2);

  orderItems.forEach((item, idx) => {
    const desc = striptags(item.product?.longDescription || "বিবরণ নেই").replace(/&nbsp;/g, " ");
    doc.fontSize(14).fillColor("#000").text(`${idx + 1}. ${item.name} (${item.size || "Lifetime"})`, { underline: true });
    doc.fontSize(12).fillColor("#333").text(desc, { width: doc.page.width - 80 });
    if (item.driveUrl || item.product?.driveUrl) {
      doc.fillColor("#007BFF").text("Download Link", { link: item.driveUrl || item.product?.driveUrl, underline: true });
    }
    doc.moveDown(1);
  });

  doc.end();
  await new Promise((resolve) => writeStream.on("finish", resolve));

  // Send Email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_ID, pass: process.env.GMAIL_PASS },
  });

  const productRows = orderItems
    .map((item) => {
      const url = item.driveUrl || item.product?.driveUrl || "#";
      const desc = item.product?.shortDescription || "";
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${item.size || "Lifetime"}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${desc}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">
            <a href="${url}" target="_blank" style="background:#007BFF;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;">Download</a>
          </td>
        </tr>`;
    })
    .join("");

  const mailOptions = {
    from: `"File Box" <${process.env.GMAIL_ID}>`,
    to: updatedOrder.customerEmail,
    subject: `🎉 Your Order ${updatedOrder.invoiceNumber} is Delivered`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f9fc;padding:20px;border-radius:10px;">
        <h2 style="color:#333;">Hello ${updatedOrder.customerName},</h2>
        <p>Your digital products are now available for download!</p>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr style="background:#007BFF;color:white;">
              <th>Product</th>
              <th>Validity</th>
              <th>Description</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
        </table>
        <p style="margin-top:20px;">Thank you for shopping with <b>File Box</b> 💙</p>
      </div>
    `,
    attachments: [{ filename: `Order_${updatedOrder.invoiceNumber}.pdf`, path: pdfPath }],
  };

  await transporter.sendMail(mailOptions);

  // Cleanup
  fs.unlink(pdfPath, (err) => { if (err) console.error(err); });
};



export const deleteOrder = async (req, res) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: req.params.id },
        data: { isDeleted: true },
      });

      if (order) {
        return res
          .status(200)
          .json(jsonResponse(true, `Order has been deleted`, order));
      } else {
        return res
          .status(404)
          .json(jsonResponse(false, "Order has not been deleted", null));
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error, null));
  }
};




// ✅ Delivery man location update করবে
export const updateDeliveryLocation = async (req, res) => {
  try {
    const deliveryManId = req.user.id;
    const { orderId, lat, lng } = req.body;

    if (!orderId || !lat || !lng) {
      return res.status(400).json(jsonResponse(false, "orderId, lat, lng required", null));
    }

    await prisma.$executeRaw`
      INSERT INTO "DeliveryLocation" ("id", "orderId", "deliveryManId", "lat", "lng", "updatedAt")
      VALUES (gen_random_uuid()::text, ${orderId}, ${deliveryManId}, ${lat}, ${lng}, NOW())
      ON CONFLICT ("orderId")
      DO UPDATE SET "lat" = ${lat}, "lng" = ${lng}, "updatedAt" = NOW(), "deliveryManId" = ${deliveryManId}
    `;

    return res.status(200).json(jsonResponse(true, "Location updated", null));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message || error, null));
  }
};
 
 
// ============================================================
// 2️⃣ Customer phone দিয়ে order + live location track করবে (public)
// GET /v1/track?phone=01XXXXXXXXX
// ============================================================
// Haversine formula — দুই GPS point এর মধ্যে দূরত্ব (km)
// Haversine formula — দুই GPS point এর মধ্যে দূরত্ব (km)
// const haversineDistance = (lat1, lng1, lat2, lng2) => {
//   const R    = 6371;
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLng = (lng2 - lng1) * Math.PI / 180;
//   const a    =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
//     Math.sin(dLng / 2) * Math.sin(dLng / 2);
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };

// // Nominatim দিয়ে address → coordinates — multiple fallback
// const geocodeAddress = async (order) => {
//   const attempts = [
//     // ১. শুধু city
//     order.customerCity,
//     // ২. address এর শেষ ২ part + city
//     order.customerAddress
//       ? [order.customerAddress.split(',').slice(-2).join(',').trim(), order.customerCity].filter(Boolean).join(', ')
//       : null,
//     // ৩. full address
//     [order.customerAddress, order.customerCity].filter(Boolean).join(', '),
//   ].filter(Boolean);

//   for (const query of attempts) {
//     try {
//       const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Bangladesh')}&format=json&limit=1&countrycodes=bd`;
//       const response = await fetch(url, { headers: { "User-Agent": "iMall-Delivery/1.0" } });
//       const data = await response.json();
//       if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
//     } catch {}
//   }
//   return null;
// };

// export const trackOrder = async (req, res) => {
//   try {
//     const { phone } = req.query;

//     if (!phone) {
//       return res.status(400).json({ success: false, message: "Phone number required", data: null });
//     }

//     const order = await prisma.order.findFirst({
//       where: { customerPhone: phone, isDeleted: false },
//       orderBy: { createdAt: "desc" },
//       include: {
//         orderItems: true,
//         User_Order_deliveryManIdToUser: {
//           select: { id: true, name: true, phone: true },
//         },
//       },
//     });

//     if (!order) {
//       return res.status(404).json({ success: false, message: "এই নম্বরে কোনো অর্ডার পাওয়া যায়নি", data: null });
//     }

//     // Live location
//     let location = null;
//     if (order.deliveryManId && (order.status === "SHIPPED" || order.status === "PENDING")) {
//       const loc = await prisma.$queryRaw`
//         SELECT "lat", "lng", "updatedAt"
//         FROM "DeliveryLocation"
//         WHERE "orderId" = ${order.id}
//         LIMIT 1
//       `;
//       location = loc?.[0] || null;
//     }

//     // ✅ ETA calculation — SHIPPED এবং location থাকলে
//     let eta = null;
//     if (location && order.status === "SHIPPED") {
//       // Customer এর address geocode করো
//       const customerAddress = [
//         order.customerAddress,
//         order.customerCity,
//       ].filter(Boolean).join(", ");

//       const customerCoords = await geocodeAddress(order);

//       if (customerCoords) {
//         const distanceKm = haversineDistance(
//           parseFloat(location.lat),
//           parseFloat(location.lng),
//           customerCoords.lat,
//           customerCoords.lng
//         );

//         // Dhaka traffic average speed: 20 km/h
//         const avgSpeedKmh  = 20;
//         const timeHours    = distanceKm / avgSpeedKmh;
//         const timeMinutes  = Math.round(timeHours * 60);

//         eta = {
//           distanceKm:   Math.round(distanceKm * 10) / 10, // 1 decimal
//           minutes:      timeMinutes,
//           customerLat:  customerCoords.lat,
//           customerLng:  customerCoords.lng,
//           // Human readable
//           label: timeMinutes < 1
//             ? "প্রায় এসে গেছে!"
//             : timeMinutes < 60
//               ? `প্রায় ${timeMinutes} মিনিট`
//               : `প্রায় ${Math.floor(timeMinutes / 60)} ঘণ্টা ${timeMinutes % 60} মিনিট`,
//         };
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Order fetched successfully",
//       data: {
//         invoice:       order.invoiceNumber,
//         status:        order.status,
//         createdAt:     order.createdAt,
//         assignedAt:    order.assignedAt,
//         deliveredAt:   order.deliveredAt,
//         customerName:  order.customerName,
//         customerPhone: order.customerPhone,
//         orderItems:    order.orderItems,
//         deliveryMan:   order.User_Order_deliveryManIdToUser
//           ? { name: order.User_Order_deliveryManIdToUser.name, phone: order.User_Order_deliveryManIdToUser.phone }
//           : null,
//         location,
//         eta, // ✅ { distanceKm, minutes, label, customerLat, customerLng }
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: err.message || "Internal Server Error", data: null });
//   }
// };

// Nominatim দিয়ে address → coordinates
// Nominatim দিয়ে address → coordinates


// Nominatim দিয়ে address → coordinates — structured query
// Customer যা দিয়েছে সেটাই সরাসরি search করো
const geocodeAddress = async (order) => {
  const city    = order.customerCity || "Dhaka";
  const address = order.customerAddress || "";

  const attempts = [
    address ? `${address}, ${city}, Bangladesh` : null,
    address ? `${address}, Bangladesh` : null,
    `${city}, Bangladesh`,
  ].filter(Boolean);

  for (const query of attempts) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=bd`,
        { headers: { "User-Agent": "iMall-Delivery/1.0" } }
      );
      const d = await r.json();
      if (d?.[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
    } catch {}
  }
  return null;
};

const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRiNWRlMGU0Y2UxYjRjMzliNDNjNmM3ZmRjYmNkOTE2IiwiaCI6Im11cm11cjY0In0=";
 
const getRouteETA = async (fromLat, fromLng, toLat, toLng) => {
  try {
    const url =
      `https://api.openrouteservice.org/v2/directions/driving-car` +
      `?api_key=${ORS_API_KEY}` +
      `&start=${fromLng},${fromLat}` +
      `&end=${toLng},${toLat}`;
 
    const res  = await fetch(url);
    const data = await res.json();
 
    const summary = data?.features?.[0]?.properties?.summary;
    if (!summary) return null;
 
    const distanceKm  = Math.round((summary.distance / 1000) * 10) / 10;
    const durationMin = Math.round(summary.duration / 60);
 
    const label =
      distanceKm < 0.3
        ? "প্রায় এসে গেছে! 🎉"
        : durationMin < 1
          ? "প্রায় এসে গেছে!"
          : durationMin < 60
            ? `প্রায় ${durationMin} মিনিট`
            : `প্রায় ${Math.floor(durationMin / 60)} ঘণ্টা ${durationMin % 60} মিনিট`;
 
    return { distanceKm, minutes: durationMin, label };
  } catch (err) {
    console.error("ORS Error:", err.message);
    return null;
  }
};

// ✅ 1. Rider Online/Offline toggle + location update
// Rider dashboard থেকে প্রতি 10s এ call হবে
export const updateRiderLocationAndStatus = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { lat, lng, isOnline } = req.body;

    await prisma.riderLocation.upsert({
      where: { deliveryManId: riderId },
      update: {
        ...(lat && { lat: parseFloat(lat) }),
        ...(lng && { lng: parseFloat(lng) }),
        ...(isOnline !== undefined && { isOnline }),
        updatedAt: new Date(),
      },
      create: {
        deliveryManId: riderId,
        lat: parseFloat(lat) || 0,
        lng: parseFloat(lng) || 0,
        isOnline: isOnline ?? false,
      },
    });

    return res.status(200).json(jsonResponse(true, "Updated", null));
  } catch (error) {
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

// ✅ 2. Rider এর current status (dashboard load এ call হবে)
export const getRiderStatus = async (req, res) => {
  try {
    const riderId = req.user.id;

    const [riderLocation, activeOrder] = await Promise.all([
      prisma.riderLocation.findUnique({
        where: { deliveryManId: riderId },
      }),
      prisma.order.findFirst({
        where: {
          deliveryManId: riderId,
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          isDeleted: false,
        },
        include: { orderItems: true },
      }),
    ]);

    return res.status(200).json(jsonResponse(true, "Rider status", {
      isOnline: riderLocation?.isOnline ?? false,
      activeOrder: activeOrder ?? null,
    }));
  } catch (error) {
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};

export const trackOrder = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number required", data: null });
    }

    const order = await prisma.order.findFirst({
      where: { customerPhone: phone, isDeleted: false },
      orderBy: { createdAt: "desc" },
      include: {
        orderItems: true,
        User_Order_deliveryManIdToUser: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "এই নম্বরে কোনো অর্ডার পাওয়া যায়নি", data: null });
    }

    // Live location
    let location = null;
    if (order.deliveryManId && (order.status === "SHIPPED" || order.status === "PENDING")) {
      const loc = await prisma.$queryRaw`
        SELECT "lat", "lng", "updatedAt"
        FROM "DeliveryLocation"
        WHERE "orderId" = ${order.id}
        LIMIT 1
      `;
      location = loc?.[0] || null;
    }

    // ✅ ETA — customer lat/lng থাকলে directly use করো, না থাকলে geocode
    let eta = null;
    if (location && order.status === "SHIPPED") {
      // ✅ Customer pin drop করলে সেটাই use করো — সবচেয়ে accurate
      let customerCoords = null;
      if (order.customerLat && order.customerLng) {
        customerCoords = { lat: parseFloat(order.customerLat), lng: parseFloat(order.customerLng) };
      } else {
        customerCoords = await geocodeAddress(order);
      }

      if (customerCoords) {
        const route = await getRouteETA(
          parseFloat(location.lat),
          parseFloat(location.lng),
          customerCoords.lat,
          customerCoords.lng
        );

        if (route) {
          eta = {
            ...route,
            customerLat: customerCoords.lat,
            customerLng: customerCoords.lng,
          };
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: {
        invoice:       order.invoiceNumber,
        status:        order.status,
        createdAt:     order.createdAt,
        assignedAt:    order.assignedAt,
        deliveredAt:   order.deliveredAt,
        customerName:  order.customerName,
        customerPhone: order.customerPhone,
        orderItems:    order.orderItems,
        deliveryMan:   order.User_Order_deliveryManIdToUser
          ? { name: order.User_Order_deliveryManIdToUser.name, phone: order.User_Order_deliveryManIdToUser.phone }
          : null,
        location,
        eta, // { distanceKm, minutes, label, customerLat, customerLng }
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error", data: null });
  }
};










// ✅ Latest Order Fetch Controller
export const getLatestOrder = async (req, res) => {
  try {
    const latestOrder = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      include: { orderItems: true },
    });

    if (!latestOrder) {
      return res.status(404).json({ success: false, message: "No orders found" });
    }

    return res.status(200).json({ success: true, data: latestOrder });
  } catch (error) {
    console.error("GET LATEST ORDER ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};



export const fraudCheckByOrderPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number required",
        data: null,
      });
    }

    // 🔑 Call FraudChecker API directly with phone
    const formData = new FormData();
    formData.append("phone", phone);

    const response = await axios.post(
      "https://fraudchecker.link/api/v1/qc/",
      formData,
      {
        headers: {
          "Authorization": "Bearer 39df4730f65cba4f7d17430ddedd6390",
          ...formData.getHeaders?.(), // Node environment e FormData headers
        },
      }
    );

    const result = response.data;

    // ✅ Return the full API response
    return res.status(200).json({
      success: true,
      message: "Fraud check completed successfully",
      data: result,
    });
  } catch (err) {
    console.error(err?.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
      data: null,
    });
  }
};



// get monthly order count for a year
export const getMonthlyOrderCountYearWise = async (req, res) => {
  try {
    const currentYear = req.params.year
      ? Number(req.params.year)
      : new Date().getFullYear();

    // Aggregate orders by month
    const monthlyOrders = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") AS month,
        COUNT(*) AS total_orders
      FROM "Order"
      WHERE "createdAt" >= ${new Date(`${currentYear}-01-01`)}
        AND "createdAt" < ${new Date(`${currentYear + 1}-01-01`)}
      GROUP BY EXTRACT(MONTH FROM "createdAt")
      ORDER BY month ASC;
    `;

    // Initialize months array
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Fill all months with 0 if no orders
    const monthlyCounts = monthNames.map((month, index) => {
      const found = monthlyOrders.find((row) => Number(row.month) === index + 1);
      return {
        month,
        count: found ? Number(found.total_orders) : 0,
      };
    });

    return res
      .status(200)
      .json(jsonResponse(true, `Monthly order count for ${currentYear}`, monthlyCounts));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json(jsonResponse(false, "Something went wrong", null));
  }
};


// delivery man

// ✅ 1️⃣ Assign delivery man — assignedAt set করো
// export const assignDeliveryManToOrder = async (req, res) => {
//   try {
//     const { orderId, deliveryManId } = req.body;
 
//     if (!orderId || !deliveryManId) {
//       return res.status(400).json(jsonResponse(false, "Order ID and Delivery Man ID are required", null));
//     }
 
//     const order = await prisma.order.update({
//       where: { id: orderId },
//       data: {
//         deliveryManId,
//         assignedAt: new Date(), // ✅ assign time save
//       },
//       include: { user: true, orderItems: true },
//     });
 
//     // send email to delivery man
//     if (order && order.deliveryManId) {
//       const deliveryMan = await prisma.user.findUnique({ where: { id: deliveryManId } });
//       if (deliveryMan && deliveryMan.email) {
//         const emailBody = `
//           <p>Hi ${deliveryMan.name},</p>
//           <p>You have been assigned a new order:</p>
//           <p>Invoice: ${order.invoiceNumber}</p>
//           <p>Customer: ${order.customerName} (${order.customerPhone})</p>
//           <p>Address: ${order.customerAddress}, ${order.customerCity}</p>
//         `;
//         await sendEmail(deliveryMan.email, `New Order Assigned — Invoice #${order.invoiceNumber}`, emailBody);
//       }
//     }
 
//     return res.status(200).json(jsonResponse(true, "Delivery man assigned successfully", order));
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error.message || error, null));
//   }
// };
 

export function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Pending offers tracker ───────────────────────────────
// { orderId: { riderId, timeoutId, resolve } }
const pendingOffers = new Map();

// Webhook থেকে call হবে — rider accept/reject করলে
export function resolveOffer(orderId, riderId, accepted) {
  const offer = pendingOffers.get(orderId);
  if (!offer || offer.riderId !== riderId) return false;
  clearTimeout(offer.timeoutId);
  pendingOffers.delete(orderId);
  offer.resolve(accepted);
  return true;
}

// ── Offer পাঠাও, response এর জন্য wait করো ─────────────
function sendOffer(telegramChatId, orderId, rider, order, sendTelegramMessage) {
  return new Promise((resolve) => {
    const TIMEOUT_SEC = 45;

    sendTelegramMessage(
      telegramChatId,
`🛵 <b>নতুন Order Offer!</b>

📋 <b>Invoice:</b> #${order.invoiceNumber}
👤 <b>Customer:</b> ${order.customerName}
📞 <b>Phone:</b> ${order.customerPhone}
📍 <b>Address:</b> ${order.customerAddress}, ${order.customerCity}
📏 <b>Distance:</b> ${rider.distance.toFixed(2)} km
⏰ <b>${TIMEOUT_SEC} সেকেন্ডের মধ্যে Accept করুন!</b>`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Accept", callback_data: `accept_${orderId}` },
            { text: "❌ Reject", callback_data: `reject_${orderId}` },
          ]],
        },
      }
    );

    const timeoutId = setTimeout(() => {
      pendingOffers.delete(orderId);
      resolve(false);
    }, TIMEOUT_SEC * 1000);

    pendingOffers.set(orderId, { riderId: rider.id, timeoutId, resolve });
  });
}



// ✅ Assign delivery man — assignedAt set করো

// ✅ Assign delivery man — assignedAt set করো
export const assignDeliveryManToOrder = async (req, res) => {
  try {
    const { orderId, deliveryManId } = req.body;

    if (!orderId || !deliveryManId) {
      return res.status(400).json(jsonResponse(false, "Order ID and Delivery Man ID are required", null));
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryManId,
        assignedAt: new Date(),
      },
      include: {
        user: true,
        orderItems: {
          include: {
            product: {
              include: {
                brand: { select: { name: true } }, // ✅ brand name
              }
            }
          }
        }
      },
    });

    if (order && order.deliveryManId) {
      const deliveryMan = await prisma.user.findUnique({
        where: { id: deliveryManId },
      });

      // ── Email notification ──────────────────────
      if (deliveryMan?.email) {
        const emailBody = `
          <p>Hi ${deliveryMan.name},</p>
          <p>You have been assigned a new order:</p>
          <p>Invoice: ${order.invoiceNumber}</p>
          <p>Customer: ${order.customerName} (${order.customerPhone})</p>
          <p>Address: ${order.customerAddress}, ${order.customerCity}</p>
        `;
        await sendEmail(deliveryMan.email, `New Order Assigned — Invoice #${order.invoiceNumber}`, emailBody);
      }

      // ── Telegram notification ───────────────────
      if (deliveryMan?.telegramChatId) {

        // ✅ Brand name + variant সহ item list
        const itemList = order.orderItems
          ?.map(i => {
            const brand   = i.product?.brand?.name || i.brandName || "";
            const variant = i.size ? ` (${i.size})` : "";
            return `  • ${brand ? brand + " — " : ""}${i.name}${variant} ×${i.quantity}`;
          })
          .join("\n") || "—";

        // ✅ Bangladesh time (UTC+6)
        const bdTime = new Date(Date.now() + 6 * 60 * 60 * 1000)
          .toISOString()
          .replace("T", " ")
          .slice(0, 16);

        const message =
`🛵 <b>নতুন Order Assign হয়েছে!</b>

📋 <b>Invoice:</b> #${order.invoiceNumber}
👤 <b>Customer:</b> ${order.customerName}
📞 <b>Phone:</b> ${order.customerPhone}
📍 <b>Address:</b> ${order.customerAddress}, ${order.customerCity}

🛍️ <b>Items:</b>
${itemList}

💰 <b>Total:</b> ৳${order.subtotal}
💳 <b>Payment:</b> ${order.paymentMethod || "COD"}

⏰ <b>Assigned:</b> ${bdTime} (BD Time)

👉 <a href="https://admin.i-mall.com.bd/delivery">Dashboard এ Login করুন</a> এবং order status update করুন।`;

        await sendTelegramMessage(deliveryMan.telegramChatId, message);
      }
    }

    return res.status(200).json(jsonResponse(true, "Delivery man assigned successfully", order));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message || error, null));
  }
};






 
// ✅ 2️⃣ Delivery man status update — DELIVERED হলে deliveredAt set করো
export const updateOrderStatusByDeliveryMan = async (req, res) => {
  try {
    const deliveryManId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json(jsonResponse(false, "Status is required", null));
    }

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return res.status(404).json(jsonResponse(false, "Order not found", null));
    }

    if (order.deliveryManId !== deliveryManId) {
      return res.status(403).json(jsonResponse(false, "You can only update your assigned orders", null));
    }

    // ✅ DELIVERED হলে transaction এ করো
    if (status === "DELIVERED") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id },
          data: { status, deliveredAt: new Date() },
        }),
        // ✅ Rider আবার available — isOnline ঠিক থাকবে
        // RiderLocation এ কোনো change নেই, শুধু order নেই বলেই available
      ]);
    } else {
      await prisma.order.update({
        where: { id },
        data: { status },
      });
    }

    return res.status(200).json(jsonResponse(true, "Order status updated successfully", null));
  } catch (error) {
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};
// 2️⃣ Delivery man sees only their assigned orders
export const getOrdersForDeliveryMan = async (req, res) => {
  try {
    const deliveryManId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { deliveryManId, isDeleted: false },
      include: { orderItems: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(jsonResponse(true, `${orders.length} orders found`, orders));
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message || error, null));
  }
};

// 3️⃣ Delivery man updates order status



const PLATFORM_CHARGE = 10; // Fixed
const DELIVERY_CHARGE = 30; // Fixed


export const getRevenueAnalysis = async (req, res) => {
  try {
    const { range = "monthly", from, to } = req.query;
 
    const now = new Date();
    let fromDate, toDate = to ? new Date(to) : now;
 
    if (from) {
      fromDate = new Date(from);
    } else {
      if (range === "daily")   fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (range === "weekly")  fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (range === "monthly") fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      if (range === "yearly")  fromDate = new Date(now.getFullYear(), 0, 1);
    }
 
    // Previous period for comparison
    const periodMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - periodMs);
    const prevTo   = new Date(fromDate.getTime() - 1);
 
    // ── Fetch orders ─────────────────────────────
    const [orders, prevOrders, allTimeOrders] = await Promise.all([
      prisma.order.findMany({
        where: { isDeleted: false, createdAt: { gte: fromDate, lte: toDate } },
        include: { orderItems: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.findMany({
        where: { isDeleted: false, createdAt: { gte: prevFrom, lte: prevTo } },
        select: { id: true, subtotal: true, status: true },
      }),
      prisma.order.findMany({
        where: { isDeleted: false },
        include: { orderItems: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
 
    const delivered = orders.filter(o => o.status === "DELIVERED");
    const canceled  = orders.filter(o => o.status === "CANCELED" || o.status === "CANCELLED");
    const returned  = orders.filter(o => o.status === "RETURNED");
    const pending   = orders.filter(o => o.status === "PENDING");
    const shipped   = orders.filter(o => o.status === "SHIPPED");
 
    // ── Summary ──────────────────────────────────
    const totalRevenue        = delivered.reduce((s, o) => s + Number(o.subtotal ?? 0), 0);
    const totalCost           = delivered.reduce((s, o) => s + (o.orderItems?.reduce((ss, i) => ss + Number(i.totalCostPrice ?? 0), 0) || 0), 0);
    const totalPlatformCharge = delivered.length * PLATFORM_CHARGE;
    const totalDeliveryCharge = delivered.length * DELIVERY_CHARGE;
    const productProfit       = totalRevenue - totalCost;                                    // Product বেচে লাভ
    const chargeIncome        = totalPlatformCharge + totalDeliveryCharge;                   // Charge থেকে income
    const totalProfit         = productProfit + chargeIncome;                                // মোট profit
    const avgOrderValue       = delivered.length > 0 ? totalRevenue / delivered.length : 0;
    const totalItems          = delivered.reduce((s, o) => s + (o.orderItems?.reduce((ss, i) => ss + i.quantity, 0) || 0), 0);
 
    // Previous period
    const prevDelivered = prevOrders.filter(o => o.status === "DELIVERED");
    const prevRevenue   = prevDelivered.reduce((s, o) => s + Number(o.subtotal ?? 0), 0);
    const growthRate    = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 100;
 
    // ── All-time stats ────────────────────────────
    const allTimeDelivered        = allTimeOrders.filter(o => o.status === "DELIVERED");
    const allTimeRevenue          = allTimeDelivered.reduce((s, o) => s + Number(o.subtotal ?? 0), 0);
    const allTimeCost             = allTimeDelivered.reduce((s, o) => s + (o.orderItems?.reduce((ss, i) => ss + Number(i.totalCostPrice ?? 0), 0) || 0), 0);
    const allTimeProductProfit    = allTimeRevenue - allTimeCost;
    const allTimePlatformCharge   = allTimeDelivered.length * PLATFORM_CHARGE;
    const allTimeDeliveryCharge   = allTimeDelivered.length * DELIVERY_CHARGE;
    const allTimeChargeIncome     = allTimePlatformCharge + allTimeDeliveryCharge;
    const allTimeTotalProfit      = allTimeProductProfit + allTimeChargeIncome;
 
    // ── Year-wise stats ───────────────────────────
    const yearMap = {};
    for (const o of allTimeOrders) {
      const year = new Date(o.createdAt).getFullYear().toString();
      if (!yearMap[year]) yearMap[year] = { year, revenue: 0, orders: 0, delivered: 0, platformCharge: 0, deliveryCharge: 0 };
      yearMap[year].orders++;
      if (o.status === "DELIVERED") {
        yearMap[year].revenue          += Number(o.subtotal ?? 0);
        yearMap[year].delivered++;
        yearMap[year].platformCharge   += PLATFORM_CHARGE;
        yearMap[year].deliveryCharge   += DELIVERY_CHARGE;
      }
    }
    const yearWise = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year));
 
    // ── Daily trend ──────────────────────────────
    const dailyMap = {};
    for (const o of orders) {
      const day = o.createdAt.toISOString().split("T")[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, orders: 0, canceled: 0 };
      if (o.status === "DELIVERED") dailyMap[day].revenue += Number(o.subtotal ?? 0);
      dailyMap[day].orders++;
      if (o.status === "CANCELED" || o.status === "CANCELLED") dailyMap[day].canceled++;
    }
    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
 
    // ── Monthly trend ────────────────────────────
    const monthlyMap = {};
    for (const o of orders) {
      const month = o.createdAt.toISOString().slice(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, revenue: 0, orders: 0, platformCharge: 0, deliveryCharge: 0 };
      if (o.status === "DELIVERED") {
        monthlyMap[month].revenue        += Number(o.subtotal ?? 0);
        monthlyMap[month].platformCharge += PLATFORM_CHARGE;
        monthlyMap[month].deliveryCharge += DELIVERY_CHARGE;
      }
      monthlyMap[month].orders++;
    }
    const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
 
    // ── Product wise profit ───────────────────────
    const productProfitMap = {};
    for (const o of delivered) {
      for (const item of (o.orderItems || [])) {
        const key = item.productId || item.name;
        if (!productProfitMap[key]) {
          productProfitMap[key] = {
            name:      item.name,
            brandName: item.brandName || "—",
            revenue:   0,
            cost:      0,
            profit:    0,
            qty:       0,
            orders:    new Set(),
          };
        }
        const rev  = Number(item.totalPrice     ?? 0);
        const cost = Number(item.totalCostPrice ?? 0);
        productProfitMap[key].revenue += rev;
        productProfitMap[key].cost    += cost;
        productProfitMap[key].profit  += rev - cost;
        productProfitMap[key].qty     += item.quantity;
        productProfitMap[key].orders.add(o.id);
      }
    }
    const topProfitProducts = Object.values(productProfitMap)
      .map(p => ({
        ...p,
        orders: p.orders.size,
        margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 15);
 
    // ── Payment method ────────────────────────────
    const paymentMap = {};
    for (const o of orders) {
      const method = o.paymentMethod || "COD";
      if (!paymentMap[method]) paymentMap[method] = { method, count: 0, revenue: 0 };
      paymentMap[method].count++;
      if (o.status === "DELIVERED") paymentMap[method].revenue += Number(o.subtotal ?? 0);
    }
    const paymentBreakdown = Object.values(paymentMap).sort((a, b) => b.revenue - a.revenue);
 
    // ── Status breakdown ─────────────────────────
    const statusBreakdown = [
      { status: "DELIVERED", count: delivered.length, revenue: totalRevenue },
      { status: "PENDING",   count: pending.length,   revenue: 0 },
      { status: "SHIPPED",   count: shipped.length,   revenue: 0 },
      { status: "CANCELED",  count: canceled.length,  revenue: 0 },
      { status: "RETURNED",  count: returned.length,  revenue: 0 },
    ];
 
    // ── Peak hours ───────────────────────────────
    const hourMap = {};
    for (const o of orders) {
      const hour = new Date(o.createdAt).getHours();
      if (!hourMap[hour]) hourMap[hour] = { hour, count: 0 };
      hourMap[hour].count++;
    }
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h, count: hourMap[h]?.count || 0, label: `${h.toString().padStart(2, "0")}:00`,
    }));
 
    // ── Peak days ────────────────────────────────
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayMap = {};
    for (const o of orders) {
      const day = new Date(o.createdAt).getDay();
      if (!dayMap[day]) dayMap[day] = { day, name: dayNames[day], count: 0 };
      dayMap[day].count++;
    }
    const peakDays = Array.from({ length: 7 }, (_, d) => ({
      day: d, name: dayNames[d], count: dayMap[d]?.count || 0,
    }));
 
    // ── City wise ────────────────────────────────
    const cityMap = {};
    for (const o of delivered) {
      const city = o.customerCity || "Unknown";
      if (!cityMap[city]) cityMap[city] = { city, revenue: 0, orders: 0 };
      cityMap[city].revenue += Number(o.subtotal ?? 0);
      cityMap[city].orders++;
    }
    const cityWise = Object.values(cityMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
 
    // ── Top customers ─────────────────────────────
    const customerMap = {};
    for (const o of delivered) {
      const key = o.customerPhone;
      if (!customerMap[key]) customerMap[key] = { name: o.customerName, phone: o.customerPhone, revenue: 0, orders: 0 };
      customerMap[key].revenue += Number(o.subtotal ?? 0);
      customerMap[key].orders++;
    }
    const topCustomers    = Object.values(customerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const repeatCustomers = Object.values(customerMap).filter(c => c.orders > 1).length;
    const newCustomers    = Object.values(customerMap).filter(c => c.orders === 1).length;
 
    // ── Cancel reasons ────────────────────────────
    const cancelReasonMap = {};
    for (const o of canceled) {
      const reason = o.cancelReason || "Not specified";
      if (!cancelReasonMap[reason]) cancelReasonMap[reason] = { reason, count: 0 };
      cancelReasonMap[reason].count++;
    }
    const cancelReasons = Object.values(cancelReasonMap).sort((a, b) => b.count - a.count);
 
    // ── Return/Refund ─────────────────────────────
    const returnRate = orders.length > 0 ? Math.round((returned.length / orders.length) * 100) : 0;
 
    // ── Coupon usage ─────────────────────────────
    const couponOrders = orders.filter(o => o.couponId);
    const couponMap    = {};
    for (const o of couponOrders) {
      const key = o.couponCode || o.couponId;
      if (!couponMap[key]) couponMap[key] = { code: key, count: 0, revenue: 0, discount: 0 };
      couponMap[key].count++;
      couponMap[key].discount += Number(o.discount ?? 0);
      if (o.status === "DELIVERED") couponMap[key].revenue += Number(o.subtotal ?? 0);
    }
    const couponStats = Object.values(couponMap).sort((a, b) => b.count - a.count).slice(0, 10);
 
    // ── Delivery time ─────────────────────────────
    const deliveryTimes = delivered
      .filter(o => o.assignedAt && o.deliveredAt)
      .map(o => Math.round((new Date(o.deliveredAt) - new Date(o.assignedAt)) / 60000))
      .filter(m => m > 0 && m < 1440);
 
    const avgDeliveryTime = deliveryTimes.length > 0 ? Math.round(deliveryTimes.reduce((s, m) => s + m, 0) / deliveryTimes.length) : 0;
    const minDeliveryTime = deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : 0;
    const maxDeliveryTime = deliveryTimes.length > 0 ? Math.max(...deliveryTimes) : 0;
 
    // ── Best delivery men ─────────────────────────
    const deliveryManMap = {};
    for (const o of delivered) {
      if (!o.deliveryManId) continue;
      const key = o.deliveryManId;
      if (!deliveryManMap[key]) deliveryManMap[key] = { id: key, name: "Unknown", delivered: 0, revenue: 0, totalTime: 0, timeCount: 0 };
      deliveryManMap[key].delivered++;
      deliveryManMap[key].revenue += Number(o.subtotal ?? 0);
      if (o.assignedAt && o.deliveredAt) {
        const mins = Math.round((new Date(o.deliveredAt) - new Date(o.assignedAt)) / 60000);
        if (mins > 0 && mins < 1440) { deliveryManMap[key].totalTime += mins; deliveryManMap[key].timeCount++; }
      }
    }
 
    // Fetch delivery man names
    const deliveryManIds = Object.keys(deliveryManMap);
    if (deliveryManIds.length > 0) {
      const deliveryMen = await prisma.user.findMany({
        where: { id: { in: deliveryManIds } },
        select: { id: true, name: true, phone: true },
      });
      for (const u of deliveryMen) {
        if (deliveryManMap[u.id]) { deliveryManMap[u.id].name = u.name; deliveryManMap[u.id].phone = u.phone; }
      }
    }
    const bestDeliveryMen = Object.values(deliveryManMap)
      .map(d => ({ ...d, avgTime: d.timeCount > 0 ? Math.round(d.totalTime / d.timeCount) : 0 }))
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 10);
 
    // ── Low stock ─────────────────────────────────
    const lowStockProducts = await prisma.productAttribute.findMany({
      where: { stockAmount: { lte: 5 }, isDeleted: false },
      include: { product: { select: { name: true, brand: { select: { name: true } } } } },
      orderBy: { stockAmount: "asc" },
      take: 20,
    });
 
    return res.status(200).json(jsonResponse(true, "Revenue analysis fetched", {
      summary: {
        totalRevenue, totalOrders: orders.length, avgOrderValue, totalItems,
        totalCost, productProfit, chargeIncome, totalProfit,
        deliveredCount: delivered.length, canceledCount: canceled.length,
        returnedCount: returned.length, returnRate,
        growthRate, prevRevenue, range, fromDate, toDate,
        totalPlatformCharge, totalDeliveryCharge,
        allTimeRevenue, allTimeCost, allTimeProductProfit,
        allTimePlatformCharge, allTimeDeliveryCharge,
        allTimeChargeIncome, allTimeTotalProfit,
        allTimeOrders: allTimeDelivered.length,
        newCustomers, repeatCustomers,
        avgDeliveryTime, minDeliveryTime, maxDeliveryTime,
      },
      dailyTrend, monthlyTrend, yearWise,
      paymentBreakdown, statusBreakdown,
      peakHours, peakDays, cityWise,
      topCustomers, cancelReasons, couponStats,
      bestDeliveryMen, topProfitProducts,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id, productName: p.product?.name,
        brandName: p.product?.brand?.name, size: p.size, stock: p.stockAmount,
      })),
    }));
 
  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message, null));
  }
};



export const customerOrderAnalysis = async (req, res) => {
  try {
    const phone = req.params.phone;

    if (!phone) {
      return res.status(400).json(jsonResponse(false, "Phone is required", null));
    }

    // 🔥 1. সব order (online + offline same table থেকে)
    const orders = await prisma.order.findMany({
      where: {
        customerPhone: phone,
        isDeleted: false,
      },
      include: {
        orderItems: true,

        // ✅ delivery man info
        User_Order_deliveryManIdToUser: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!orders.length) {
      return res
        .status(200)
        .json(jsonResponse(true, "No orders found", []));
    }

    // 🔥 2. clean & enrich data
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      createdAt: order.createdAt,
      status: order.status,
      totalItems: order.totalItems,
      subtotal: order.subtotal,
      paymentMethod: order.paymentMethod,

      // ✅ online / offline detect
      type: order.orderType === "OFFLINE" ? "offline" : "online",

      // ✅ delivery man
      deliveryManName:
        order.User_Order_deliveryManIdToUser?.name || null,
      deliveryManPhone:
        order.User_Order_deliveryManIdToUser?.phone || null,

      // ✅ items
      orderItems: order.orderItems,

      // ✅ invoice info (detail page এর জন্য)
      invoice: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        deliveryCharge:
          order.deliveryChargeInside ??
          order.deliveryChargeOutside ??
          0,
        platformCharge: order.platformCharge ?? 0,
      },
    }));

    // 🔥 3. analytics
    const totalOrders = formattedOrders.length;

    const totalSpent = formattedOrders.reduce(
      (sum, o) => sum + Number(o.subtotal || 0),
      0
    );

    const onlineOrders = formattedOrders.filter(
      (o) => o.type === "online"
    ).length;

    const offlineOrders = formattedOrders.filter(
      (o) => o.type === "offline"
    ).length;

    // 🔥 4. monthly stats (last 6 months)
    const monthlyMap = {};

    formattedOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + Number(o.subtotal);
    });

    const now = new Date();

    const monthlyStats = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;

      return {
        month: d.toLocaleString("default", { month: "short" }),
        year: d.getFullYear(),
        total: monthlyMap[key] || 0,
      };
    });

    return res.status(200).json(
      jsonResponse(true, "Customer order analysis fetched", {
        summary: {
          totalOrders,
          totalSpent,
          onlineOrders,
          offlineOrders,
        },
        monthlyStats,
        orders: formattedOrders,
      })
    );
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json(jsonResponse(false, "Something went wrong", null));
  }
};