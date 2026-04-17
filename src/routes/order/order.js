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
  updateDeliveryLocation,
  trackOrder,
  paymentCallback,
  verifyPayment,
  getLatestOrder,
  fraudCheckByOrderPhone,
  getMonthlyOrderCountYearWise,
  assignDeliveryManToOrder,
  getOrdersForDeliveryMan,
  updateOrderStatusByDeliveryMan,
  getRevenueAnalysis ,
  updateRiderLocationAndStatus,
  getRiderStatus,
  getDeliveryCharge,
  getInvoiceData,
  customerOrderAnalysis
} from "../../controllers/order/order.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();
// ================== Order Routes ==================
router.post("/v1/delivery-charge", getDeliveryCharge);

router.post("/v1/orders", createOrder);
router.post("/v1/orders-init", createOrderSsl);
router.post("/v1/orders-success", createOrderSuccess);
router.post("/v1/orders-fail", createOrderFail);
router.get("/v1/orders/invoice/:orderId", getInvoiceData);
router.get("/v1/orders/latest", getLatestOrder);
router.get("/v1/orders/month-wise/:year", verify, getMonthlyOrderCountYearWise);

// ================== Delivery Man Routes ==================
// ⚠️ এগুলো অবশ্যই /v1/orders/:id এর আগে থাকতে হবে
router.post("/v1/rider/location", verify, updateRiderLocationAndStatus);
router.get("/rider/status", verify, getRiderStatus);
router.post("/v1/orders/assign-delivery-man", verify, assignDeliveryManToOrder);
router.get("/v1/orders/delivery-man", verify, getOrdersForDeliveryMan);
router.put("/v1/orders/delivery-man/:id/status", verify, updateOrderStatusByDeliveryMan);

// ================== Generic Order Routes (`:id` সবার শেষে) ==================
router.get("/v1/orders", verify, getOrders);
router.get("/v1/orders/user/:id", verify, getOrdersByUser);
router.get("/v1/orders/customer-analysis/:phone",  verify, customerOrderAnalysis);
router.get("/v1/orders/:id", verify, getOrder);
router.put("/v1/orders/:id", updateOrder);
router.delete("/v1/orders/:id", verify, deleteOrder);

// ================== Other Routes ==================
router.post("/v1/verifyPayment", verifyPayment);
router.post("/v1/delivery/location", verify, updateDeliveryLocation);

router.get("/track", trackOrder);
router.get("/v1/payment/track", paymentCallback);
router.get("/fraud-check-order", fraudCheckByOrderPhone);

router.get("/v1/analysis/revenue", verify, getRevenueAnalysis);



export default router;