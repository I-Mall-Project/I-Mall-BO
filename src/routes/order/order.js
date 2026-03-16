import express from "express";
import {
  createOrder,
  createOrderFail,
  createOrderSsl,
  createOrderSuccess,
  deleteOrder,
  getOrder,
  getOrders,
  getOrdersByUser,
  updateOrder,
  trackOrder,
  paymentCallback,
  verifyPayment,
  getLatestOrder,
  fraudCheckByOrderPhone,
  getMonthlyOrderCountYearWise,
  assignDeliveryManToOrder,
  getOrdersForDeliveryMan,
  updateOrderStatusByDeliveryMan
} from "../../controllers/order/order.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();

// ================== Order Routes ==================
router.post("/v1/orders", createOrder);
router.post("/v1/orders-init", createOrderSsl);
router.post("/v1/orders-success", createOrderSuccess);
router.post("/v1/orders-fail", createOrderFail);
router.get("/v1/orders/latest", getLatestOrder);
router.get("/v1/orders/month-wise/:year", verify, getMonthlyOrderCountYearWise);

// ================== Delivery Man Routes ==================
// ⚠️ এগুলো অবশ্যই /v1/orders/:id এর আগে থাকতে হবে
router.post("/v1/orders/assign-delivery-man", verify, assignDeliveryManToOrder);
router.get("/v1/orders/delivery-man", verify, getOrdersForDeliveryMan);
router.put("/v1/orders/delivery-man/:id/status", verify, updateOrderStatusByDeliveryMan);

// ================== Generic Order Routes (`:id` সবার শেষে) ==================
router.get("/v1/orders", verify, getOrders);
router.get("/v1/orders/user/:id", verify, getOrdersByUser);
router.get("/v1/orders/:id", verify, getOrder);
router.put("/v1/orders/:id", updateOrder);
router.delete("/v1/orders/:id", verify, deleteOrder);

// ================== Other Routes ==================
router.post("/v1/verifyPayment", verifyPayment);
router.get("/track", trackOrder);
router.get("/v1/payment/track", paymentCallback);
router.get("/fraud-check-order", fraudCheckByOrderPhone);

export default router;