import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { productImageUpload } from "../middleware/upload";
import { validate, createProductRules } from "../middleware/validate";
import {
  createProduct,
  updateProduct,
  listProductsOwnerView,
  getProductOwnerView,
  deleteProduct,
  uploadProductImages,
  replaceProductImage,
  deleteProductImage,
  setProductLocation,
  getProductLocationHistory,
  listProductsCustomerView,
} from "../controllers/productController";

const router = Router();

/**
 * PUBLIC customer-facing storefront route — no auth required, since
 * customers browsing a shop's catalog aren't logged into the business
 * system. This MUST stay before router.use(authenticate) below. Only
 * redacted fields are ever returned — see productController for the
 * exact allow-list.
 */
router.get("/public/shop/:shopId", listProductsCustomerView);

router.use(authenticate);
router.use(requireShop);

router.get("/", requirePermission("products", "view"), listProductsOwnerView);
router.get("/:productId", requirePermission("products", "view"), getProductOwnerView);
router.post("/", requirePermission("products", "create"), validate(createProductRules), createProduct);
router.put("/:productId", requirePermission("products", "edit"), updateProduct);
router.delete("/:productId", requirePermission("products", "delete"), deleteProduct);

// Images
router.post("/:productId/images", requirePermission("products", "edit"), productImageUpload.array("images", 10), uploadProductImages);
router.put("/images/:imageId", requirePermission("products", "edit"), productImageUpload.single("image"), replaceProductImage);
router.delete("/images/:imageId", requirePermission("products", "edit"), deleteProductImage);

// Location (shop -> rack -> shelf -> bin, with history)
router.post("/:productId/location", requirePermission("inventory", "edit"), setProductLocation);
router.get("/:productId/location/history", requirePermission("inventory", "view"), getProductLocationHistory);

export default router;
