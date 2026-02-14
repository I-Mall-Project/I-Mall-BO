import express from "express";
import {
  getCanceledOrder,
  getDeliveredOrder,
  getInProgressOrder,
  getPendingOrder,
  getTotalCampaign,
  getTotalCategory,
  getTotalOrder,
  getTotalProduct,
  getTotalRevenue,

  getTotalRevenueYearWise,
  getTodayTotalOrder,
  getTodaySellAmount,
  getTodayRevenue,
  getLastWeekRevenue,
  getLastWeekSale,
  getLastMonthSale,
  getLastYearSale,
  getLastMonthRevenue,
  getLastYearRevenue,
  getCurrentYearSell,
  getCurrentYearRevenue,
  getCurrentMonthSell,
  getCurrentMonthRevenue,


} from "../../controllers/dashboard/dashboard.js";
import {} from "../../utils/modules.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();

router.get(
  "/v1/dashboard/user/total-category",
  // categoryTotal,
  verify,
  getTotalCategory
);
router.get(
  "/v1/dashboard/user/total-campaign",
  // campaignTotal,
  verify,
  getTotalCampaign
);
router.get(
  "/v1/dashboard/user/total-product",
  // productTotal,
  verify,
  getTotalProduct
);
router.get(
  "/v1/dashboard/user/total-order",
  // orderTotal,
  verify,
  getTotalOrder
);
router.get(
  "/v1/dashboard/user/total-pending-order",
  // orderStatusTotal,
  verify,
  getPendingOrder
);
router.get(
  "/v1/dashboard/user/total-canceled-order",
  // orderStatusTotal,
  verify,
  getCanceledOrder
);
router.get(
  "/v1/dashboard/user/total-in-progress-order",
  // orderStatusTotal,
  verify,
  getInProgressOrder
);
router.get(
  "/v1/dashboard/user/total-delivered-order",
  // orderStatusTotal,
  verify,
  getDeliveredOrder
);
router.get(
  "/v1/dashboard/user/total-revenue",
  // revenueTotal,
  verify,
  getTotalRevenue
);
router.get(
  "/v1/dashboard/user/total-revenue-year-wise/:year",
  verify,
  getTotalRevenueYearWise
);

router.get(
  "/v1/dashboard/user/today-total-order",
  verify,
  getTodayTotalOrder
);


router.get("/v1/dashboard/user/today-sell-amount", verify, getTodaySellAmount);
router.get("/v1/dashboard/user/today-revenue", verify, getTodayRevenue);



router.get("/v1/dashboard/user/last-week", verify, getLastWeekRevenue);
router.get("/v1/dashboard/user/last-week-sale", verify, getLastWeekSale);

router.get("/v1/dashboard/user/last-month-sale", verify, getLastMonthSale);
router.get("/v1/dashboard/user/last-year-sale", verify, getLastYearSale);

router.get("/v1/dashboard/user/last-month-revenue", verify, getLastMonthRevenue);
router.get("/v1/dashboard/user/last-year-revenue", verify, getLastYearRevenue)


router.get("/v1/dashboard/user/current-year-sell", verify, getCurrentYearSell);
router.get("/v1/dashboard/user/current-year-revenue", verify, getCurrentYearRevenue);



router.get("/v1/dashboard/user/current-month-sale", verify, getCurrentMonthSell);
router.get("/v1/dashboard/user/current-month-revenue", verify, getCurrentMonthRevenue);



export default router;
