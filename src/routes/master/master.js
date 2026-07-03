// ============================================================
// routes/master/master.js
// ============================================================
import express from "express";
import {
  searchMasterCatalog,
  getCatalogFilters,
  bulkAddToShop,
  updateMedicineImage
} from "../../controllers/master/mastercatalog.js";
import verify from "../../utils/verifyToken.js";
import multer from "multer";



const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/v1/master-catalog", verify, searchMasterCatalog);
router.get("/v1/master-catalog/filters", verify, getCatalogFilters);
router.post("/v1/master-catalog/bulk-add", verify, bulkAddToShop);
router.put("/v1/master-catalog/:id/image", verify, upload.single("image"), updateMedicineImage);


export default router;