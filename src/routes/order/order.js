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
} from "../../controllers/order/order.js";
// import {
//   orderEdit,
//   orderList,
//   orderRemove,
//   orderSingle,
//   orderUserList,
// } from "../../utils/modules.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();

router.post("/v1/orders",  createOrder);
router.post("/v1/orders-init", createOrderSsl);
router.post("/v1/orders-success", createOrderSuccess);
router.post("/v1/orders-fail", createOrderFail);
// router.get("/v1/orders", orderList, verify, getOrders);
router.get("/v1/orders", verify, getOrders);
router.get("/v1/orders/latest", getLatestOrder);
// router.get("/v1/orders/user/:id", orderUserList, verify, getOrdersByUser);
router.get("/v1/orders/user/:id", verify, getOrdersByUser);
// router.get("/v1/orders/:id", orderSingle, verify, getOrder);
router.get("/v1/orders/:id", verify, getOrder);
// router.put("/v1/orders/:id", orderEdit, verify, updateOrder);
router.put("/v1/orders/:id", updateOrder);
router.post("/v1/verifyPayment", verifyPayment);


// router.delete("/v1/orders/:id", orderRemove, verify, deleteOrder);
router.delete("/v1/orders/:id", verify, deleteOrder);

router.get("/track", trackOrder);
router.get("/v1/payment/track", paymentCallback)

router.get("/fraud-check-order", fraudCheckByOrderPhone);

router.get(
  "/v1/orders/month-wise/:year",
  verify,
  getMonthlyOrderCountYearWise
);




export default router;