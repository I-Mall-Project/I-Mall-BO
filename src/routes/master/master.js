// ============================================================
// routes/master/master.js
// ============================================================
import express from "express";
import {
  searchMasterCatalog,
  getCatalogFilters,
  bulkAddToShop,
} from "../../controllers/master/masterCatalog.js";
import verify from "../../utils/verifyToken.js";

const router = express.Router();

router.get("/v1/master-catalog", verify, searchMasterCatalog);
router.get("/v1/master-catalog/filters", verify, getCatalogFilters);
router.post("/v1/master-catalog/bulk-add", verify, bulkAddToShop);

export default router;