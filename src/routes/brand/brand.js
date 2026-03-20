import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getBrand,
  getBrandForCustomer,
  getBrands,
  getBrandsForCustomer,
  updateBrand,
  // ✅ Brand Owner
  assignBrandOwner,
  removeBrandOwner,
  getBrandOwners,
  getMyBrands,
  getMyBrandOrders,
  getMyBrandAnalytics,
  getMyBrandProducts,
} from "../../controllers/brand/brand.js";
import verify from "../../utils/verifyToken.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// ── Brand (Admin) ──────────────────────────
router.post("/v1/brands", verify, upload.single("image"), createBrand);
router.get("/v1/brands", verify, getBrands);
router.get("/v1/brands/:id", verify, getBrand);
router.put("/v1/brands/:id", verify, upload.single("image"), updateBrand);
router.delete("/v1/brands/:id", verify, deleteBrand);

// ── Brand Owner Management (Admin) ─────────
router.post("/v1/brand-owner/assign",         verify, assignBrandOwner);
router.post("/v1/brand-owner/remove",          removeBrandOwner);
router.get("/v1/brand-owner/:brandId/owners",  getBrandOwners);

// ── Brand Owner Portal ──────────────────────
router.get("/v1/brand-owner/my-brands",       verify, getMyBrands);
router.get("/v1/brand-owner/my-products",     verify, getMyBrandProducts);
router.get("/v1/brand-owner/my-orders",       verify, getMyBrandOrders);
router.get("/v1/brand-owner/my-analytics",    verify, getMyBrandAnalytics);

// ── Customer ────────────────────────────────
router.get("/v1/customer/brands", getBrandsForCustomer);
router.get("/v1/customer/brands/:id", getBrandForCustomer);

export default router;