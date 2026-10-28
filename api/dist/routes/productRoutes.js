"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const upload_1 = require("../middleware/upload");
const validate_1 = require("../middleware/validate");
const productController_1 = require("../controllers/productController");
const router = (0, express_1.Router)();
/**
 * PUBLIC customer-facing storefront route — no auth required, since
 * customers browsing a shop's catalog aren't logged into the business
 * system. This MUST stay before router.use(authenticate) below. Only
 * redacted fields are ever returned — see productController for the
 * exact allow-list.
 */
router.get("/public/shop/:shopId", productController_1.listProductsCustomerView);
router.use(auth_1.authenticate);
router.use(auth_1.requireShop);
router.get("/", (0, permission_1.requirePermission)("products", "view"), productController_1.listProductsOwnerView);
router.get("/:productId", (0, permission_1.requirePermission)("products", "view"), productController_1.getProductOwnerView);
router.post("/", (0, permission_1.requirePermission)("products", "create"), (0, validate_1.validate)(validate_1.createProductRules), productController_1.createProduct);
router.put("/:productId", (0, permission_1.requirePermission)("products", "edit"), productController_1.updateProduct);
router.delete("/:productId", (0, permission_1.requirePermission)("products", "delete"), productController_1.deleteProduct);
// Images
router.post("/:productId/images", (0, permission_1.requirePermission)("products", "edit"), upload_1.productImageUpload.array("images", 10), productController_1.uploadProductImages);
router.put("/images/:imageId", (0, permission_1.requirePermission)("products", "edit"), upload_1.productImageUpload.single("image"), productController_1.replaceProductImage);
router.delete("/images/:imageId", (0, permission_1.requirePermission)("products", "edit"), productController_1.deleteProductImage);
// Location (shop -> rack -> shelf -> bin, with history)
router.post("/:productId/location", (0, permission_1.requirePermission)("inventory", "edit"), productController_1.setProductLocation);
router.get("/:productId/location/history", (0, permission_1.requirePermission)("inventory", "view"), productController_1.getProductLocationHistory);
exports.default = router;
//# sourceMappingURL=productRoutes.js.map