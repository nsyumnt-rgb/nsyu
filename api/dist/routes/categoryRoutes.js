"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const categoryController_1 = require("../controllers/categoryController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/", (0, permission_1.requirePermission)("products", "view"), categoryController_1.listCategories);
router.post("/", (0, permission_1.requirePermission)("products", "create"), categoryController_1.createCategory);
router.put("/:categoryId", (0, permission_1.requirePermission)("products", "edit"), categoryController_1.updateCategory);
router.patch("/:categoryId/status", (0, permission_1.requirePermission)("products", "edit"), categoryController_1.setCategoryStatus);
router.post("/subcategories", (0, permission_1.requirePermission)("products", "create"), categoryController_1.createSubcategory);
router.patch("/subcategories/:subcategoryId/status", (0, permission_1.requirePermission)("products", "edit"), categoryController_1.setSubcategoryStatus);
exports.default = router;
//# sourceMappingURL=categoryRoutes.js.map