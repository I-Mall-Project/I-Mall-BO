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


const generateInvoiceNumber = async (tx, brandID, productCode) => {

  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const prefix = `${year}${month}${day}${brandID}${productCode}`;

  const lastOrder = await tx.order.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  let sequence = 1;

  if (lastOrder?.invoiceNumber) {
    const lastSeq = lastOrder.invoiceNumber.slice(prefix.length);
    sequence = parseInt(lastSeq) + 1;
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
};




// export const createOrder = async (req, res) => {
//   try {
//     const {
//       userId,
//       couponId,
//       customerName,
//       customerPhone,
//       customerAddress,
//       customerBillingAddress,
//       customerEmail,
//       customerCity,
//       customerPostalCode,
//       invoiceNumber,
//       paymentMethod,
//       deliveryChargeInside,
//       deliveryChargeOutside,
//       orderItems,
//     } = req.body;

//     // Validate input
//     const inputValidation = validateInput(
//       [customerName, customerPhone, customerAddress, invoiceNumber, paymentMethod],
//       ["Name", "Phone", "Shipping Address", "Invoice", "Payment Method"]
//     );
//     if (inputValidation) {
//       return res.status(400).json(jsonResponse(false, inputValidation, null));
//     }

//     if (!orderItems || orderItems.length === 0) {
//       return res.status(400).json(jsonResponse(false, "Please select at least 1 item", null));
//     }

//     // ✅ Only DB transaction
//     const newOrder = await prisma.$transaction(async (tx) => {
//       let totalItems = 0;
//       let subtotal = 0;
//       let subtotalCost = 0;
//       let newOrderItems = [];

//       for (const item of orderItems) {
//         const product = await tx.product.findFirst({ where: { id: item.productId, isDeleted: false, isActive: true } });
//         const productAttribute = await tx.productAttribute.findFirst({ where: { id: item.productAttributeId, isDeleted: false } });

//         if (!product || !productAttribute) {
//           throw new Error("Product or attribute does not exist");
//         }

//         const totalPrice = item.quantity * productAttribute.discountedRetailPrice;
//         const totalCostPrice = item.quantity * productAttribute.costPrice;

//         newOrderItems.push({
//           ...item,
//           name: product.name,
//           size: productAttribute.size,
//           costPrice: productAttribute.costPrice,
//           retailPrice: productAttribute.retailPrice,
//           discountPercent: productAttribute.discountPercent,
//           discountPrice: productAttribute.discountPrice,
//           discountedRetailPrice: productAttribute.discountedRetailPrice,
//           totalCostPrice,
//           totalPrice,
//           quantity: item.quantity,
//         });

//         totalItems += item.quantity;
//         subtotal += totalPrice;
//         subtotalCost += totalCostPrice;
//       }

//       const coupon = couponId
//         ? await tx.coupon.findFirst({ where: { id: couponId, isActive: true } })
//         : null;

//       const deliveryCharge = deliveryChargeInside ?? deliveryChargeOutside ?? 0;
//       const finalSubtotal = subtotal + deliveryCharge - (coupon?.discountAmount ?? 0);

//       const order = await tx.order.create({
//         data: {
//           userId,
//           couponId,
//           customerName,
//           customerPhone,
//           customerAddress,
//           customerBillingAddress,
//           customerEmail,
//           customerCity,
//           customerPostalCode,
//           invoiceNumber,
//           totalItems,
//           subtotalCost,
//           subtotal: finalSubtotal,
//           paymentMethod,
//           deliveryChargeInside: deliveryChargeInside ?? null,
//           deliveryChargeOutside: deliveryChargeOutside ?? null,
//           orderItems: { create: newOrderItems },
//         },
//         include: { orderItems: true },
//       });

//       // Reduce stock
//       for (const item of orderItems) {
//         await tx.productAttribute.update({
//           where: { id: item.productAttributeId },
//           data: { stockAmount: { decrement: item.quantity } },
//         });
//       }

//       return order;
//     });

//     // ✅ Call sendEmail outside transaction
// const emailBody = `
//   <div style="
//     max-width: 650px;
//     margin: auto;
//     padding: 30px;
//     background: #ffffff;
//     border-radius: 16px;
//     border: 3px solid #ff7f50;
//     box-shadow: 0 8px 24px rgba(255, 127, 80, 0.15);
//   ">
    
//     <!-- Header with Gift Icon -->
//     <div style="text-align: center; margin-bottom: 25px;">
//       <div style="
//         font-size: 48px;
//         margin-bottom: 10px;
//       ">🎁</div>
//       <h2 style="
//         font-size: 32px;
//         margin: 0;
//         font-weight: 700;
//         color: #ff7f50;
//         font-family: 'Georgia', serif;
//       ">
//         GIFT SHOP
//       </h2>
//       <p style="
//         margin: 5px 0 0 0;
//         font-size: 14px;
//         color: #ff9966;
//         letter-spacing: 2px;
//         text-transform: uppercase;
//       ">Order Confirmation</p>
//     </div>

//     <!-- Greeting -->
//     <p style="font-size: 17px; color: #333; line-height: 1.6;">
//       Dear <strong style="color:#ff7f50;">${customerName}</strong>,
//     </p>

//     <p style="font-size: 16px; color: #555; line-height: 1.7;">
//       Thank you for choosing 
//       <strong style="color:#ff7f50;">GIFT SHOP</strong>! 
//       Your order has been confirmed and is being prepared with care. 
//       We're excited to help you spread joy! 🎉
//     </p>

//     <!-- Order Details Table -->
//     <table style="
//       width: 100%;
//       border-collapse: collapse;
//       margin-top: 25px;
//       background: linear-gradient(135deg, #fff9f5 0%, #ffe8dc 100%);
//       border-radius: 12px;
//       overflow: hidden;
//       border: 2px solid #ffb088;
//     ">
//       <tr>
//         <td style="padding: 14px 18px; font-weight: 600; color:#ff7f50; font-size: 15px;">
//           📋 Invoice Number:
//         </td>
//         <td style="padding: 14px 18px; color:#333; font-weight: 500;">
//           ${invoiceNumber}
//         </td>
//       </tr>
//       <tr style="background: rgba(255, 127, 80, 0.05);">
//         <td style="padding: 14px 18px; font-weight: 600; color:#ff7f50; font-size: 15px;">
//           📦 Total Items:
//         </td>
//         <td style="padding: 14px 18px; color:#333; font-weight: 500;">
//           ${newOrder.totalItems}
//         </td>
//       </tr>
//       <tr>
//         <td style="padding: 14px 18px; font-weight: 600; color:#ff7f50; font-size: 15px;">
//           💰 Total Amount:
//         </td>
//         <td style="padding: 14px 18px; color:#333; font-weight: 500;">
//           ${newOrder.subtotal} TK
//         </td>
//       </tr>
//       <tr style="background: rgba(255, 127, 80, 0.05);">
//         <td style="padding: 14px 18px; font-weight: 600; color:#ff7f50; font-size: 15px;">
//           💳 Payment Method:
//         </td>
//         <td style="padding: 14px 18px; color:#333; font-weight: 500;">
//           ${paymentMethod}
//         </td>
//       </tr>
//     </table>

//     <!-- Products Section -->
//     <div style="
//       margin-top: 30px;
//       padding: 20px;
//       background: #fff9f5;
//       border-radius: 10px;
//       border-left: 4px solid #ff7f50;
//     ">
//       <h3 style="
//         color: #ff7f50;
//         margin: 0 0 15px 0;
//         font-size: 20px;
//         font-weight: 700;
//         font-family: 'Georgia', serif;
//       ">
//         🎁 Your Gift Selection
//       </h3>

//       <ul style="
//         font-size: 16px; 
//         color: #444; 
//         padding-left: 20px;
//         line-height: 1.8;
//         margin: 0;
//       ">
//         ${newOrder.orderItems
//           .map(item => `<li style="margin-bottom: 8px; color: #555;">
//             <span style="color: #ff7f50; font-weight: 600;">✨</span> ${item.name}
//           </li>`)
//           .join("")}
//       </ul>
//     </div>

//     <!-- Divider -->
//     <hr style="border: 0; border-top: 2px solid #ffe8dc; margin: 30px 0;">

//     <!-- Contact Information -->
//     <div style="
//       background: linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%);
//       padding: 20px;
//       border-radius: 10px;
//       text-align: center;
//     ">
//       <p style="font-size: 18px; color: #ff7f50; font-weight: 700; margin: 0 0 15px 0; font-family: 'Georgia', serif;">
//         GIFT SHOP
//       </p>
//       <p style="font-size: 14px; color: #666; line-height: 1.7; margin: 0;">
//         📍 Dhaka Outlet, Bailey Road, AQP Shopping Mall<br/>
//         📞 Phone: 01748399860<br/>
//         🆘 Helpline: 01748399860<br/>
//         ✉️ Email: 
//         <a href="mailto:giftshop@gmail.com" style="color: #ff7f50; text-decoration:none; font-weight: 600;">
//           giftshop@gmail.com
//         </a>
//       </p>
//     </div>

//     <!-- Footer Message -->
//     <div style="
//       text-align: center;
//       margin-top: 30px;
//       padding: 20px;
//       background: #ff7f50;
//       border-radius: 10px;
//     ">
//       <p style="
//         font-size: 16px;
//         margin: 0;
//         color: #ffffff;
//         font-weight: 600;
//         letter-spacing: 1px;
//       ">
//         🎊 Thank you for making someone's day special! 🎊
//       </p>
//       <p style="
//         font-size: 13px;
//         margin: 8px 0 0 0;
//         color: #ffe8dc;
//       ">
//         Every gift tells a story. We're honored to be part of yours.
//       </p>
//     </div>

//   </div>

// `;

// await sendEmail(customerEmail, `Order Invoice #${invoiceNumber}`, emailBody);
// await sendEmail("shamimrocky801@yahoo.com", `New Order Received #${invoiceNumber}`, emailBody);

// return res.status(200).json(jsonResponse(true, "Your order has been placed successfully", newOrder));


//   } catch (error) {
//     console.log("ORDER ERROR:", error);
//     return res.status(500).json(jsonResponse(false, error.message || error, null));
//   }
// };



// export const createOrder = async (req, res) => {
//   try {
//     const {
//       userId,
//       couponId,
//       customerName,
//       customerPhone,
//       customerAddress,
//       customerBillingAddress,
//       customerEmail,
//       customerCity,
//       customerPostalCode,
//       paymentMethod,
//       deliveryChargeInside,
//       deliveryChargeOutside,
//       orderItems,
//     } = req.body;

//     const inputValidation = validateInput(
//       [customerName, customerPhone, customerAddress, paymentMethod],
//       ["Name", "Phone", "Shipping Address", "Payment Method"]
//     );

//     if (inputValidation) {
//       return res.status(400).json(jsonResponse(false, inputValidation, null));
//     }

//     if (!orderItems || orderItems.length === 0) {
//       return res
//         .status(400)
//         .json(jsonResponse(false, "Please select at least 1 item", null));
//     }

//     const firstItem = orderItems[0];

//     const productInfo = await prisma.product.findFirst({
//       where: {
//         id: firstItem.productId,
//         isDeleted: false,
//         isActive: true,
//       },
//       include: {
//         brand: true,
//       },
//     });

//     if (!productInfo) {
//       return res
//         .status(400)
//         .json(jsonResponse(false, "Product not found", null));
//     }

//     const invoiceNumber = await generateInvoiceNumber(
//       prisma,
//       productInfo.brand?.brandID || "00",
//       productInfo.productCode || "0000"
//     );

//     const brandName = productInfo.brand?.name || "iMall";

//     const newOrder = await prisma.$transaction(async (tx) => {
//       let totalItems = 0;
//       let subtotal = 0;
//       let subtotalCost = 0;
//       let newOrderItems = [];

//       for (const item of orderItems) {
//         const product = await tx.product.findFirst({
//           where: {
//             id: item.productId,
//             isDeleted: false,
//             isActive: true,
//           },
//           include: {
//             brand: true,
//           },
//         });

//         const productAttribute = await tx.productAttribute.findFirst({
//           where: {
//             id: item.productAttributeId,
//             isDeleted: false,
//           },
//         });

//         if (!product || !productAttribute) {
//           throw new Error("Product or attribute does not exist");
//         }

//         const totalPrice = item.quantity * productAttribute.discountedRetailPrice;
//         const totalCostPrice = item.quantity * productAttribute.costPrice;

//         newOrderItems.push({
//           productId: item.productId,
//             productCode: item.productCode,  

//           productAttributeId: item.productAttributeId,
//           name: product.name,
//           size: productAttribute.size,
//           costPrice: productAttribute.costPrice,
//           retailPrice: productAttribute.retailPrice,
//           discountPercent: productAttribute.discountPercent,
//           discountPrice: productAttribute.discountPrice,
//           discountedRetailPrice: productAttribute.discountedRetailPrice,
//           totalCostPrice,
//           totalPrice,
//           quantity: item.quantity,
//         });

//         totalItems += item.quantity;
//         subtotal += totalPrice;
//         subtotalCost += totalCostPrice;
//       }

//       const coupon = couponId
//         ? await tx.coupon.findFirst({
//             where: { id: couponId, isActive: true },
//           })
//         : null;

//       const deliveryCharge = deliveryChargeInside ?? deliveryChargeOutside ?? 0;
//       const finalSubtotal =
//         subtotal + deliveryCharge - (coupon?.discountAmount ?? 0);

//       const order = await tx.order.create({
//         data: {
//           userId,
//           couponId,
//           customerName,
//           customerPhone,
//           customerAddress,
//           customerBillingAddress,
//           customerEmail,
//           customerCity,
//           customerPostalCode,
//           invoiceNumber,
//           totalItems,
//           subtotalCost,
//           subtotal: finalSubtotal,
//           paymentMethod,
//           deliveryChargeInside: deliveryChargeInside ?? null,
//           deliveryChargeOutside: deliveryChargeOutside ?? null,
//           orderItems: {
//             create: newOrderItems,
//           },
//         },
//         include: {
//           orderItems: true,
//         },
//       });

//       for (const item of orderItems) {
//         await tx.productAttribute.update({
//           where: { id: item.productAttributeId },
//           data: {
//             stockAmount: {
//               decrement: item.quantity,
//             },
//           },
//         });
//       }

//       return order;
//     });

//     const orderTime = new Date();
//     const estimatedDelivery = new Date(orderTime.getTime() + 40 * 60 * 1000);

//     const formatTime = (date) => {
//       return date.toLocaleTimeString("en-BD", {
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//         timeZone: "Asia/Dhaka",
//       });
//     };

//     const deliveryCharge = deliveryChargeInside ?? deliveryChargeOutside ?? 0;
//     const deliveryLabel = deliveryChargeInside != null ? "Inside Dhaka" : "Outside Dhaka";

//     const emailBody = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
// </head>
// <body style="margin:0;padding:0;background:#f0ece8;">

// <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece8;padding:30px 0;">
//   <tr>
//     <td align="center">
//       <table width="620" cellpadding="0" cellspacing="0" style="
//         background:#ffffff;
//         border-radius:16px;
//         overflow:hidden;
//         box-shadow:0 4px 20px rgba(0,0,0,0.07);
//         font-family:'Segoe UI',Arial,sans-serif;
//       ">

//         <!-- TOP GRADIENT BAR -->
//         <tr>
//           <td style="
//             background:linear-gradient(135deg,#c8773a,#b5622c);
//             padding:28px 30px;
//             text-align:center;
//           ">
//             <h1 style="
//               margin:0;
//               font-size:36px;
//               font-weight:900;
//               color:#ffffff;
//               letter-spacing:2px;
//             ">iMall</h1>
//             <p style="
//               margin:6px 0 0;
//               color:rgba(255,255,255,0.82);
//               font-size:13px;
//               letter-spacing:0.5px;
//             ">Genuine Products · Express Delivery</p>
//           </td>
//         </tr>

//         <!-- ORDER CONFIRMED BADGE -->
//         <tr>
//           <td style="
//             background:#fdf6f0;
//             padding:20px 30px;
//             text-align:center;
//             border-bottom:1px solid #e8d5c8;
//           ">
//             <span style="
//               display:inline-block;
//               background:linear-gradient(135deg,#c8773a,#b5622c);
//               color:#fff;
//               font-size:13px;
//               font-weight:700;
//               padding:6px 20px;
//               border-radius:30px;
//               letter-spacing:1px;
//             ">✔ ORDER CONFIRMED</span>
//           </td>
//         </tr>

//         <!-- BODY -->
//         <tr>
//           <td style="padding:30px;">

//             <!-- Greeting -->
//             <p style="font-size:16px;color:#333;margin:0 0 6px;">
//               Dear <strong style="color:#c8773a;">${customerName}</strong>,
//             </p>
//             <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px;">
//               Thank you for shopping with <strong style="color:#c8773a;">iMall</strong>.
//               Your order from <strong style="color:#c8773a;">${brandName}</strong> has been
//               successfully placed and is now being prepared for express delivery.
//             </p>

//             <!-- Ordered Items Table -->
//             <p style="
//               font-size:13px;
//               font-weight:700;
//               color:#c8773a;
//               text-transform:uppercase;
//               letter-spacing:1px;
//               margin:0 0 10px;
//             ">Ordered Items</p>

//             <table width="100%" cellpadding="0" cellspacing="0" style="
//               border:1px solid #e8d5c8;
//               border-radius:10px;
//               overflow:hidden;
//               font-size:14px;
//               margin-bottom:24px;
//             ">
//               <thead>
//                 <tr style="background:linear-gradient(135deg,#c8773a,#b5622c);">
//                   <th style="padding:10px 14px;color:#fff;text-align:left;font-weight:600;">Product</th>
//                   <th style="padding:10px 14px;color:#fff;text-align:center;font-weight:600;">Size</th>
//                   <th style="padding:10px 14px;color:#fff;text-align:center;font-weight:600;">Qty</th>
//                   <th style="padding:10px 14px;color:#fff;text-align:right;font-weight:600;">Unit Price</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 ${newOrder.orderItems
//                   .map(
//                     (item, index) => `
//                   <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fdf6f0"};">
//                     <td style="padding:10px 14px;color:#333;">${item.name}</td>
//                     <td style="padding:10px 14px;color:#555;text-align:center;">${item.size || "—"}</td>
//                     <td style="padding:10px 14px;color:#555;text-align:center;">${item.quantity}</td>
//                     <td style="padding:10px 14px;color:#c8773a;font-weight:600;text-align:right;">${item.discountedRetailPrice} TK</td>
//                   </tr>
//                 `
//                   )
//                   .join("")}
//               </tbody>
//             </table>

//             <!-- Order Summary -->
//             <p style="
//               font-size:13px;
//               font-weight:700;
//               color:#c8773a;
//               text-transform:uppercase;
//               letter-spacing:1px;
//               margin:0 0 10px;
//             ">Order Summary</p>

//             <table width="100%" cellpadding="0" cellspacing="0" style="
//               background:#fdf6f0;
//               border:1px solid #e8d5c8;
//               border-radius:10px;
//               overflow:hidden;
//               font-size:14px;
//               margin-bottom:24px;
//             ">
//               <tr>
//                 <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Invoice No</td>
//                 <td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">#${invoiceNumber}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Delivery Address</td>
//                 <td style="padding:10px 16px;color:#333;text-align:right;border-bottom:1px solid #e8d5c8;">${customerAddress}${customerCity ? `, ${customerCity}` : ""}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Total Items</td>
//                 <td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">${newOrder.totalItems}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Payment Method</td>
//                 <td style="padding:10px 16px;color:#333;text-align:right;border-bottom:1px solid #e8d5c8;">${paymentMethod}</td>
//               </tr>
//               <tr>
//                 <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">
//                   Delivery Charge
//                   <span style="
//                     font-size:11px;
//                     color:#fff;
//                     background:#c8773a;
//                     padding:2px 8px;
//                     border-radius:10px;
//                     margin-left:6px;
//                     font-weight:600;
//                   ">${deliveryLabel}</span>
//                 </td>
//                 <td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">${deliveryCharge} TK</td>
//               </tr>
//               <tr>
//                 <td style="padding:12px 16px;color:#333;font-weight:700;font-size:15px;">Total Amount</td>
//                 <td style="padding:12px 16px;color:#c8773a;font-weight:800;font-size:16px;text-align:right;">${newOrder.subtotal} TK</td>
//               </tr>
//             </table>

//             <!-- Delivery Time Box -->
//             <table width="100%" cellpadding="0" cellspacing="0" style="
//               background:linear-gradient(135deg,#c8773a,#b5622c);
//               border-radius:12px;
//               overflow:hidden;
//               margin-bottom:24px;
//             ">
//               <tr>
//                 <td style="padding:22px;text-align:center;color:#fff;">
//                   <div style="font-size:36px;margin-bottom:8px;">⏰</div>
//                   <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">
//                     Express Delivery — 30 to 40 Minutes
//                   </p>
//                   <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
//                     <tr>
//                       <td style="text-align:center;width:50%;padding:0 8px;">
//                         <p style="margin:0;font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">Order Placed At</p>
//                         <p style="
//                           margin:6px 0 0;
//                           font-size:18px;
//                           font-weight:700;
//                           background:rgba(255,255,255,0.18);
//                           padding:6px 14px;
//                           border-radius:20px;
//                           display:inline-block;
//                         ">${formatTime(orderTime)}</p>
//                       </td>
//                       <td style="
//                         text-align:center;
//                         width:50%;
//                         padding:0 8px;
//                         border-left:1px solid rgba(255,255,255,0.3);
//                       ">
//                         <p style="margin:0;font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">Estimated Arrival</p>
//                         <p style="
//                           margin:6px 0 0;
//                           font-size:18px;
//                           font-weight:700;
//                           background:rgba(255,255,255,0.18);
//                           padding:6px 14px;
//                           border-radius:20px;
//                           display:inline-block;
//                         ">${formatTime(estimatedDelivery)}</p>
//                       </td>
//                     </tr>
//                   </table>
//                 </td>
//               </tr>
//             </table>

//             <!-- Delivery Progress -->
//             <p style="
//               font-size:13px;
//               font-weight:700;
//               color:#c8773a;
//               text-transform:uppercase;
//               letter-spacing:1px;
//               margin:0 0 10px;
//             ">Delivery Status</p>
//             <div style="
//               background:#e8d5c8;
//               border-radius:20px;
//               overflow:hidden;
//               height:14px;
//               margin-bottom:8px;
//             ">
//               <div style="
//                 width:70%;
//                 height:100%;
//                 background:linear-gradient(90deg,#c8773a,#b5622c);
//                 border-radius:20px;
//               "></div>
//             </div>
//             <p style="font-size:13px;color:#888;text-align:center;margin:0 0 24px;">
//               🟤 Order Confirmed &nbsp;→&nbsp; 🚚 Out for Delivery &nbsp;→&nbsp; 📦 Arriving Soon
//             </p>

//             <!-- Need Help -->
//             <div style="
//               background:#fdf6f0;
//               border:1px solid #e8d5c8;
//               border-radius:10px;
//               padding:14px 18px;
//               font-size:13px;
//               color:#666;
//               line-height:1.7;
//             ">
//               <strong style="color:#c8773a;">Need help?</strong>
//               Contact us at
//               <a href="tel:01748399860" style="color:#c8773a;text-decoration:none;font-weight:600;">01748399860</a>
//               or email
//               <a href="mailto:support@imall.com" style="color:#c8773a;text-decoration:none;font-weight:600;">support@imall.com</a>
//             </div>

//           </td>
//         </tr>

//         <!-- FOOTER -->
//         <tr>
//           <td style="
//             background:#fdf6f0;
//             border-top:1px solid #e8d5c8;
//             padding:20px 30px;
//             text-align:center;
//           ">
//             <p style="margin:0;font-size:15px;font-weight:800;color:#c8773a;">iMall</p>
//             <p style="margin:6px 0 0;font-size:12px;color:#999;line-height:1.8;">
//               📍 Level 4, AQP Shopping Mall, Bailey Road, Ramna, Dhaka-1000<br/>
//               📞 01748399860 &nbsp;·&nbsp; ✉️ support@imall.com
//             </p>
//             <p style="margin:12px 0 0;font-size:11px;color:#bbb;">
//               © ${new Date().getFullYear()} iMall. All rights reserved.
//             </p>
//           </td>
//         </tr>

//       </table>
//     </td>
//   </tr>
// </table>

// </body>
// </html>`;

//     await sendEmail(
//       customerEmail,
//       `Order Placed from I-Mall — Invoice #${invoiceNumber}`,
//       emailBody
//     );
//     await sendEmail(
//       "shamimrocky801@yahoo.com",
//       `New Order Received — Invoice #${invoiceNumber}`,
//       emailBody
//     );

//     return res
//       .status(200)
//       .json(jsonResponse(true, "Your order has been placed successfully", newOrder));

//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(jsonResponse(false, error.message || error, null));
//   }
// };

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
      deliveryChargeInside,
      deliveryChargeOutside,
      platformCharge, // ✅ NEW
      orderItems,
    } = req.body;

    // ✅ Input Validation
    const inputValidation = validateInput(
      [customerName, customerPhone, customerAddress, paymentMethod],
      ["Name", "Phone", "Shipping Address", "Payment Method"]
    );

    if (inputValidation) {
      return res.status(400).json(jsonResponse(false, inputValidation, null));
    }

    if (!orderItems || orderItems.length === 0) {
      return res
        .status(400)
        .json(jsonResponse(false, "Please select at least 1 item", null));
    }

    const firstItem = orderItems?.[0];

    const productInfo = await prisma.product.findFirst({
      where: {
        id: firstItem.productId,
        isDeleted: false,
        isActive: true,
      },
      include: {
        brand: true,
      },
    });

    if (!productInfo) {
      return res
        .status(400)
        .json(jsonResponse(false, "Product not found", null));
    }

    const invoiceNumber = await generateInvoiceNumber(
      prisma,
      productInfo.brand?.brandID || "00",
      productInfo.productCode || "0000"
    );

    const newOrder = await prisma.$transaction(async (tx) => {
      let totalItems = 0;
      let subtotal = 0;
      let subtotalCost = 0;
      let newOrderItems = [];

      for (const item of orderItems) {
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            isDeleted: false,
            isActive: true,
          },
          include: {
            brand: true,
          },
        });

        const productAttribute = await tx.productAttribute.findFirst({
          where: {
            id: item.productAttributeId,
            isDeleted: false,
          },
        });

        if (!product || !productAttribute) {
          throw new Error("Product or attribute does not exist");
        }

        const totalPrice =
          item.quantity * productAttribute.discountedRetailPrice;

        const totalCostPrice =
          item.quantity * productAttribute.costPrice;

        newOrderItems.push({
          productId: item.productId,
          productCode: product.productCode || null,
          barcode: product.barcode || null,
          brandId: product.brandId || null,
          brandName: product.brand?.name || null,
          productAttributeId: item.productAttributeId,
          name: product.name,
          size: productAttribute.size,
          costPrice: productAttribute.costPrice,
          retailPrice: productAttribute.retailPrice,
          discountPercent: productAttribute.discountPercent,
          discountPrice: productAttribute.discountPrice,
          discountedRetailPrice:
            productAttribute.discountedRetailPrice,
          totalCostPrice,
          totalPrice,
          quantity: item.quantity,
        });

        totalItems += item.quantity;
        subtotal += totalPrice;
        subtotalCost += totalCostPrice;
      }

      const coupon = couponId
        ? await tx.coupon.findFirst({
            where: { id: couponId, isActive: true },
          })
        : null;

      const deliveryCharge =
        deliveryChargeInside ?? deliveryChargeOutside ?? 0;

      const safePlatformCharge = Number(platformCharge) || 0; // ✅ NEW

      const finalSubtotal =
        subtotal +
        deliveryCharge +
        safePlatformCharge - // ✅ platformCharge add
        (coupon?.discountAmount ?? 0);

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

          invoiceNumber,
          totalItems,
          subtotalCost,
          subtotal: finalSubtotal,

          paymentMethod,
          deliveryChargeInside: deliveryChargeInside ?? null,
          deliveryChargeOutside: deliveryChargeOutside ?? null,
          platformCharge: safePlatformCharge, // ✅ SAVE

          orderItems: {
            create: newOrderItems,
          },
        },
        include: {
          orderItems: true,
        },
      });

      for (const item of orderItems) {
        await tx.productAttribute.update({
          where: { id: item.productAttributeId },
          data: {
            stockAmount: {
              decrement: item.quantity,
            },
          },
        });
      }

      return order;
    });
    const orderTime = new Date();
    const estimatedDelivery = new Date(orderTime.getTime() + 40 * 60 * 1000);

    const formatTime = (date) => {
      return date.toLocaleTimeString("en-BD", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dhaka",
      });
    };

    const deliveryCharge = deliveryChargeInside ?? deliveryChargeOutside ?? 0;
    const deliveryLabel = deliveryChargeInside != null ? "Inside Dhaka" : "Outside Dhaka";

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
      <table width="620" cellpadding="0" cellspacing="0" style="
        background:#ffffff;
        border-radius:16px;
        overflow:hidden;
        box-shadow:0 4px 20px rgba(0,0,0,0.07);
        font-family:'Segoe UI',Arial,sans-serif;
      ">

        <!-- TOP GRADIENT BAR -->
        <tr>
          <td style="
            background:linear-gradient(135deg,#c8773a,#b5622c);
            padding:28px 30px;
            text-align:center;
          ">
            <h1 style="
              margin:0;
              font-size:36px;
              font-weight:900;
              color:#ffffff;
              letter-spacing:2px;
            ">iMall</h1>
            <p style="
              margin:6px 0 0;
              color:rgba(255,255,255,0.82);
              font-size:13px;
              letter-spacing:0.5px;
            ">Genuine Products · Express Delivery</p>
          </td>
        </tr>

        <!-- ORDER CONFIRMED BADGE -->
        <tr>
          <td style="
            background:#fdf6f0;
            padding:20px 30px;
            text-align:center;
            border-bottom:1px solid #e8d5c8;
          ">
            <span style="
              display:inline-block;
              background:linear-gradient(135deg,#c8773a,#b5622c);
              color:#fff;
              font-size:13px;
              font-weight:700;
              padding:6px 20px;
              border-radius:30px;
              letter-spacing:1px;
            ">✔ ORDER CONFIRMED</span>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:30px;">

            <!-- Greeting -->
            <p style="font-size:16px;color:#333;margin:0 0 6px;">
              Dear <strong style="color:#c8773a;">${customerName}</strong>,
            </p>
            <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px;">
              Thank you for shopping with <strong style="color:#c8773a;">iMall</strong>.
              successfully placed and is now being prepared for express delivery.
            </p>

            <!-- Ordered Items Table -->
            <p style="
              font-size:13px;
              font-weight:700;
              color:#c8773a;
              text-transform:uppercase;
              letter-spacing:1px;
              margin:0 0 10px;
            ">Ordered Items</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="
              border:1px solid #e8d5c8;
              border-radius:10px;
              overflow:hidden;
              font-size:14px;
              margin-bottom:24px;
            ">
              <thead>
                <tr style="background:linear-gradient(135deg,#c8773a,#b5622c);">
                  <th style="padding:10px 14px;color:#fff;text-align:left;font-weight:600;">Product</th>
                  <th style="padding:10px 14px;color:#fff;text-align:center;font-weight:600;">Size</th>
                  <th style="padding:10px 14px;color:#fff;text-align:center;font-weight:600;">Qty</th>
                  <th style="padding:10px 14px;color:#fff;text-align:right;font-weight:600;">Unit Price</th>
                </tr>
              </thead>
              <tbody>
                ${newOrder.orderItems
                  .map(
                    (item, index) => `
                  <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fdf6f0"};">
                    <td style="padding:10px 14px;color:#333;">${item.name}</td>
                    <td style="padding:10px 14px;color:#555;text-align:center;">${item.size || "—"}</td>
                    <td style="padding:10px 14px;color:#555;text-align:center;">${item.quantity}</td>
                    <td style="padding:10px 14px;color:#c8773a;font-weight:600;text-align:right;">${item.discountedRetailPrice} TK</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>

            <!-- Order Summary -->
            <p style="
              font-size:13px;
              font-weight:700;
              color:#c8773a;
              text-transform:uppercase;
              letter-spacing:1px;
              margin:0 0 10px;
            ">Order Summary</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="
              background:#fdf6f0;
              border:1px solid #e8d5c8;
              border-radius:10px;
              overflow:hidden;
              font-size:14px;
              margin-bottom:24px;
            ">
              <tr>
                <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Invoice No</td>
                <td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">#${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Delivery Address</td>
                <td style="padding:10px 16px;color:#333;text-align:right;border-bottom:1px solid #e8d5c8;">${customerAddress}${customerCity ? `, ${customerCity}` : ""}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Total Items</td>
                <td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">${newOrder.totalItems}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">Payment Method</td>
                <td style="padding:10px 16px;color:#333;text-align:right;border-bottom:1px solid #e8d5c8;">${paymentMethod}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#555;border-bottom:1px solid #e8d5c8;">
                  Delivery Charge
                  <span style="
                    font-size:11px;
                    color:#fff;
                    background:#c8773a;
                    padding:2px 8px;
                    border-radius:10px;
                    margin-left:6px;
                    font-weight:600;
                  ">${deliveryLabel}</span>
                </td>
                <td style="padding:10px 16px;color:#333;font-weight:600;text-align:right;border-bottom:1px solid #e8d5c8;">${deliveryCharge} TK</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#333;font-weight:700;font-size:15px;">Total Amount</td>
                <td style="padding:12px 16px;color:#c8773a;font-weight:800;font-size:16px;text-align:right;">${newOrder.subtotal} TK</td>
              </tr>
            </table>

            <!-- Delivery Time Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="
              background:linear-gradient(135deg,#c8773a,#b5622c);
              border-radius:12px;
              overflow:hidden;
              margin-bottom:24px;
            ">
              <tr>
                <td style="padding:22px;text-align:center;color:#fff;">
                  <div style="font-size:36px;margin-bottom:8px;">⏰</div>
                  <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                    Express Delivery — 30 to 40 Minutes
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                    <tr>
                      <td style="text-align:center;width:50%;padding:0 8px;">
                        <p style="margin:0;font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">Order Placed At</p>
                        <p style="
                          margin:6px 0 0;
                          font-size:18px;
                          font-weight:700;
                          background:rgba(255,255,255,0.18);
                          padding:6px 14px;
                          border-radius:20px;
                          display:inline-block;
                        ">${formatTime(orderTime)}</p>
                      </td>
                      <td style="
                        text-align:center;
                        width:50%;
                        padding:0 8px;
                        border-left:1px solid rgba(255,255,255,0.3);
                      ">
                        <p style="margin:0;font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">Estimated Arrival</p>
                        <p style="
                          margin:6px 0 0;
                          font-size:18px;
                          font-weight:700;
                          background:rgba(255,255,255,0.18);
                          padding:6px 14px;
                          border-radius:20px;
                          display:inline-block;
                        ">${formatTime(estimatedDelivery)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Delivery Progress -->
            <p style="
              font-size:13px;
              font-weight:700;
              color:#c8773a;
              text-transform:uppercase;
              letter-spacing:1px;
              margin:0 0 10px;
            ">Delivery Status</p>
            <div style="
              background:#e8d5c8;
              border-radius:20px;
              overflow:hidden;
              height:14px;
              margin-bottom:8px;
            ">
              <div style="
                width:70%;
                height:100%;
                background:linear-gradient(90deg,#c8773a,#b5622c);
                border-radius:20px;
              "></div>
            </div>
            <p style="font-size:13px;color:#888;text-align:center;margin:0 0 24px;">
              🟤 Order Confirmed &nbsp;→&nbsp; 🚚 Out for Delivery &nbsp;→&nbsp; 📦 Arriving Soon
            </p>

            <!-- Need Help -->
            <div style="
              background:#fdf6f0;
              border:1px solid #e8d5c8;
              border-radius:10px;
              padding:14px 18px;
              font-size:13px;
              color:#666;
              line-height:1.7;
            ">
              <strong style="color:#c8773a;">Need help?</strong>
              Contact us at
              <a href="tel:01748399860" style="color:#c8773a;text-decoration:none;font-weight:600;">01748399860</a>
              or email
              <a href="mailto:support@imall.com" style="color:#c8773a;text-decoration:none;font-weight:600;">support@imall.com</a>
            </div>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="
            background:#fdf6f0;
            border-top:1px solid #e8d5c8;
            padding:20px 30px;
            text-align:center;
          ">
            <p style="margin:0;font-size:15px;font-weight:800;color:#c8773a;">iMall</p>
            <p style="margin:6px 0 0;font-size:12px;color:#999;line-height:1.8;">
              📍 Level 4, AQP Shopping Mall, Bailey Road, Ramna, Dhaka-1000<br/>
              📞 01748399860 &nbsp;·&nbsp; ✉️ support@imall.com
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#bbb;">
              © ${new Date().getFullYear()} iMall. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

    await sendEmail(
      customerEmail,
      `Order Placed from I-Mall — Invoice #${invoiceNumber}`,
      emailBody
    );
    await sendEmail(
      "shamimrocky801@yahoo.com",
      `New Order Received — Invoice #${invoiceNumber}`,
      emailBody
    );

    return res
      .status(200)
      .json(jsonResponse(true, "Your order has been placed successfully", newOrder));

  } catch (error) {
    console.log(error);
    return res.status(500).json(jsonResponse(false, error.message || error, null));
  }
};




// export const createOrderSsl = async (req, res) => {
//   try {
//     const {
//       userId,
//       couponId,
//       customerName,
//       customerPhone,
//       customerAddress,
//       customerBillingAddress,
//       customerEmail,
//       customerCity,
//       customerPostalCode,
//       invoiceNumber,
//       paymentMethod,
//       orderItems,
//     } = req.body;

//     if (!orderItems || orderItems.length === 0) {
//       return res.status(404).json(jsonResponse(false, "Please select at least 1 item", null));
//     }

//     let totalNumberOfItems = 0;
//     let subtotal = 0;
//     let subtotalCost = 0;
//     let newOrderItems = [];
//     let allProductNames = "";

//     for (let i = 0; i < orderItems.length; i++) {
//       const product = await prisma.product.findFirst({
//         where: { id: orderItems[i].productId, isDeleted: false, isActive: true },
//       });
//       const productAttribute = await prisma.productAttribute.findFirst({
//         where: { id: orderItems[i].productAttributeId, isDeleted: false },
//       });

//       if (!product || !productAttribute) {
//         return res.status(409).json(jsonResponse(false, "Product does not exist", null));
//       }

//       newOrderItems.push({
//         ...orderItems[i],
//         name: product.name,
//         size: productAttribute.size,
//         costPrice: productAttribute.costPrice,
//         retailPrice: productAttribute.retailPrice,
//         discountPercent: productAttribute.discountPercent,
//         discountPrice: productAttribute.discountPrice,
//         discountedRetailPrice: productAttribute.discountedRetailPrice,
//         totalCostPrice: orderItems[i].quantity * productAttribute.costPrice,
//         totalPrice: orderItems[i].quantity * productAttribute.discountedRetailPrice,
//         quantity: orderItems[i].quantity,
//       });

//       totalNumberOfItems += orderItems[i].quantity;
//       subtotal += orderItems[i].quantity * productAttribute.discountedRetailPrice;
//       subtotalCost += orderItems[i].quantity * productAttribute.costPrice;
//       allProductNames += (allProductNames ? ", " : "") + product.name;
//     }

//     const coupon = couponId
//       ? await prisma.coupon.findFirst({ where: { id: couponId, isActive: true } })
//       : undefined;

//     if (paymentMethod?.toLowerCase() === "digital payment") {
//       // ✅ Ensure postal code is always provided
//       const postalCode = customerPostalCode || "1000";

//       const data = {
//         total_amount: subtotal - (coupon?.discountAmount ?? 0),
//         currency: "BDT",
//         tran_id: invoiceNumber,
//         success_url: "https://isp-core.vercel.app/api/v1/orders-success",
//         fail_url: "https://isp-core.vercel.app/api/v1/orders-fail",
//         cancel_url: "https://isp-core.vercel.app/api/v1/orders-fail",
//         ipn_url: "http://localhost:3000/ipn/",
//         shipping_method: "N/A",
//         product_name: allProductNames,
//         product_category: "Product",
//         product_profile: "general",
//         cus_name: customerName,
//         cus_email: customerEmail,
//         cus_add1: customerBillingAddress || customerAddress,
//         cus_add2: "",
//         cus_city: customerCity,
//         cus_state: customerCity,
//         cus_postcode: postalCode,
//         cus_country: "Bangladesh",
//         cus_phone: customerPhone,
//         cus_fax: "",
//         ship_name: customerName,
//         ship_add1: customerAddress,
//         ship_add2: "",
//         ship_city: customerCity,
//         ship_state: customerCity,
//         ship_postcode: postalCode,
//         ship_country: "Bangladesh",
//       };

//       try {
//         const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
//         const apiResponse = await sslcz.init(data);

//         console.log("SSLCommerz raw response:", apiResponse);

//         if (!apiResponse || !apiResponse.GatewayPageURL) {
//           return res.status(400).json(
//             jsonResponse(false, "Failed to get Gateway URL", { error: apiResponse })
//           );
//         }

//         return res.status(200).json(
//           jsonResponse(true, "Redirecting to SSL COMMERZ.", { gateway: apiResponse.GatewayPageURL })
//         );
//       } catch (sslError) {
//         console.error("SSLCommerz init error:", sslError);
//         return res.status(500).json(jsonResponse(false, "SSLCommerz init failed", { error: sslError }));
//       }
//     } else {
//       return res.status(400).json(jsonResponse(false, "Invalid payment method", null));
//     }
//   } catch (err) {
//     console.error("createOrderSsl error:", err);
//     return res.status(500).json(jsonResponse(false, "Order creation failed", { error: err }));
//   }
// };



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

// //get all orders
// export const getOrders = async (req, res) => {
//   if (req.user.roleName !== "super-admin") {
//     getOrdersByUser(req, res);
//   } else {
//     try {
//       const orders = await prisma.order.findMany({
//         where: {
//           isDeleted: false,
//           // AND: [
//           //   {
//           //     customerName: {
//           //       contains: req.query.customer_name,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     customerPhone: {
//           //       contains: req.query.customer_phone,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     customerAddress: {
//           //       contains: req.query.customer_address,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     customerCity: {
//           //       contains: req.query.customer_city,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     customerPostalCode: {
//           //       contains: req.query.customer_postal_code,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     invoiceNumber: {
//           //       contains: req.query.invoice_number,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     paymentMethod: {
//           //       contains: req.query.payment_method,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           //   {
//           //     status: {
//           //       contains: req.query.status,
//           //       mode: "insensitive",
//           //     },
//           //   },
//           // ],
//         },
//         include: {
//           orderItems: true,
//         },
//         orderBy: {
//           createdAt: "desc",
//         },
//         skip:
//           req.query.limit && req.query.page
//             ? parseInt(req.query.limit * (req.query.page - 1))
//             : parseInt(defaultLimit() * (defaultPage() - 1)),
//         take: req.query.limit
//           ? parseInt(req.query.limit)
//           : parseInt(defaultLimit()),
//       });

//       if (orders.length === 0)
//         return res
//           .status(200)
//           .json(jsonResponse(true, "No order is available", null));

//       if (orders) {
//         return res
//           .status(200)
//           .json(jsonResponse(true, `${orders.length} orders found`, orders));
//       } else {
//         return res
//           .status(404)
//           .json(jsonResponse(false, "Something went wrong. Try again", null));
//       }
//     } catch (error) {
//       console.log(error);
//       return res.status(500).json(jsonResponse(false, error, null));
//     }
//   }
// };

//get all orders
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
                  images: true, // include product images
                },
              },
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

      // Map orderItems to include first image only
      const ordersWithImages = orders.map((order) => ({
        ...order,
        orderItems: order.orderItems.map((item) => ({
          ...item,
          image: item.product?.images?.length > 0 ? item.product.images[0].image : null,
        })),
      }));

      return res.status(200).json(
        jsonResponse(
          true,
          `${ordersWithImages.length} orders found`,
          ordersWithImages
        )
      );
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json(jsonResponse(false, "Something went wrong. Try again", null));
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











// // 🔹 PDF generation
// const generateProductPdf = (order, orderItems) => {
//   return new Promise((resolve, reject) => {
//     try {
//       const pdfPath = path.join(process.cwd(), `order-${order.invoiceNumber}.pdf`);
//       const doc = new PDFDocument({ size: "A4", margin: 50 });

//       doc.pipe(fs.createWriteStream(pdfPath));

//       doc.fontSize(20).fillColor("#2E86C1").text("File Box", { align: "center" });
//       doc.moveDown();
//       doc.fontSize(14).fillColor("#000").text(`Invoice: ${order.invoiceNumber}`);
//       doc.text(`Customer: ${order.customerName}`);
//       doc.text(`Email: ${order.customerEmail}`);
//       doc.text(`Phone: ${order.customerPhone}`);
//       doc.moveDown();

//       // Table Header
//       doc.fillColor("#ffffff").rect(50, doc.y, 500, 20).fill("#007BFF").stroke();
//       doc.fillColor("#ffffff").text("Product", 55, doc.y - 18);
//       doc.text("Size", 200, doc.y - 18);
//       doc.text("Quantity", 300, doc.y - 18);
//       doc.text("Price", 400, doc.y - 18);
//       doc.text("Total", 470, doc.y - 18);
//       doc.moveDown();

//       // Table Content
//       orderItems.forEach((item) => {
//         doc.fillColor("#000");
//         doc.text(item.name, 55, doc.y);
//         doc.text(item.size, 200, doc.y);
//         doc.text(item.quantity.toString(), 300, doc.y);
//         doc.text(item.discountedRetailPrice.toString() + " TK", 400, doc.y);
//         doc.text(item.totalPrice.toString() + " TK", 470, doc.y);
//         doc.moveDown();
//         doc.fillColor("#555").fontSize(10).text(`Description: ${item.longDescription || "N/A"}`, { indent: 20 });
//         doc.moveDown();
//       });

//       // Footer
//       doc.moveDown();
//       doc.fontSize(12).fillColor("#000").text(`Subtotal: ${order.subtotal} TK`, { align: "right" });
//       doc.text(`Delivery Charge: ${order.deliveryChargeInside ?? 0} TK`, { align: "right" });
//       doc.text(`Total Items: ${order.totalItems}`, { align: "right" });

//       doc.end();
//       resolve(pdfPath);
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// // 🔹 Mail sending
// const sendDeliveredMailWithPdf = async (order, orderItems) => {
//   try {
//     console.log("📨 Preparing to send mail for order:", order.id);

//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.GMAIL_ID,
//         pass: process.env.GMAIL_PASS,
//       },
//     });

//     // Generate PDF
//     const pdfPath = await generateProductPdf(order, orderItems);

//     // Build product table HTML for mail body
//     const productListHtml = orderItems
//       .map((item) => {
//         const url = item.driveUrl?.trim() || "#";
//         return `
//           <tr>
//             <td>${item.name}</td>
//             <td>${item.size}</td>
//             <td><a href="${url}" target="_blank" style="background:#007BFF;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;">Download</a></td>
           
//           </tr>
//         `;
//       })
//       .join("");

//     const mailOptions = {
//       from: `"File Box" <${process.env.GMAIL_ID}>`,
//       to: order.customerEmail,
//       subject: `🎉 Your Order ${order.invoiceNumber} is Delivered`,
//       html: `
//         <div style="font-family:Arial,sans-serif;background:#f7f9fc;padding:20px;border-radius:10px;">
//           <h2>Hello ${order.customerName},</h2>
//           <p>Your digital products are ready! Download from below links or see attached PDF.</p>
//           <table style="width:100%;border-collapse:collapse;margin-top:10px;">
//             <thead>
//               <tr style="background:#007BFF;color:white;">
//                 <th>Product</th>
//                 <th>Size</th>
//                 <th>Download</th>
//                 <th>Description</th>
//               </tr>
//             </thead>
//             <tbody>${productListHtml}</tbody>
//           </table>
//           <p style="margin-top:20px;">Thank you for shopping with <b>File Box</b> 💙</p>
//         </div>
//       `,
//       attachments: [
//         {
//           filename: `Invoice-${order.invoiceNumber}.pdf`,
//           path: pdfPath,
//         },
//       ],
//     };

//     console.log("📨 Sending mail to:", order.customerEmail);
//     const info = await transporter.sendMail(mailOptions);
//     console.log("✅ Mail sent successfully:", info.messageId);
//   } catch (err) {
//     console.error("❌ Failed to send delivered mail:", err);
//   }
// };

// // 🔹 Update Order controller
// export const updateOrder = async (req, res) => {
//   try {
//     const { status } = req.body;

//     const order = await prisma.order.findUnique({
//       where: { id: req.params.id },
//       include: { orderItems: true },
//     });

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     const updatedOrder = await prisma.order.update({
//       where: { id: req.params.id },
//       data: { status },
//       include: { orderItems: true },
//     });

//     console.log("updateOrder called for orderId:", updatedOrder.id, "with status:", status);

//     if (status === "DELIVERED") {
//       console.log("🔹 Triggering delivered mail outside transaction...");
//       await sendDeliveredMailWithPdf(updatedOrder, updatedOrder.orderItems);
//     }

//     return res.status(200).json({ success: true, message: "Order updated", data: updatedOrder });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// };









//delete order
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

// track order by invoice number
// backend/controllers/orderController.ts
// export const trackOrder = async (req, res) => {
//   try {
//     const { invoice } = req.query;
//     if (!invoice) return res.status(400).json({ success: false, message: "Invoice number required", data: null });

//     const order = await prisma.order.findFirst({
//       where: { invoiceNumber: invoice },
//       include: { orderItems: true },
//     });

//     if (!order) return res.status(404).json({ success: false, message: "Order not found", data: null });

//     return res.status(200).json({
//       success: true,
//       message: "Order fetched successfully",
//       data: {
//         invoice: order.invoiceNumber,
//         status: order.status,
//         updatedAt: order.updatedAt,
//         estimatedDelivery: order.estimatedDelivery,
//         orderItems: order.orderItems,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: err.message, data: null });
//   }
// };

export const trackOrder = async (req, res) => {
  try {
    const { phone } = req.query;

    // 🔴 phone validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone number required",
        data: null,
      });
    }

    // 🔍 Find latest order by phone number
    const order = await prisma.order.findFirst({
      where: {
        customerPhone: phone,
      },
      orderBy: {
        createdAt: "desc", // latest order
      },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "No order found with this phone number",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: {
        invoice: order.invoiceNumber,
        status: order.status,
        updatedAt: order.updatedAt,
        estimatedDelivery: order.estimatedDelivery,
        customerPhone: order.customerPhone,
        orderItems: order.orderItems,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
      data: null,
    });
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
