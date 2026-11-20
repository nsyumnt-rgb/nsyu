import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { productImageUpload } from "../middleware/upload";
import {
  createCategory,
  listCategories,
  updateCategory,
  uploadCategoryImage,
  deleteCategory,
  setCategoryStatus,
  createSubcategory,
  setSubcategoryStatus,
} from "../controllers/categoryController";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("products", "view"), listCategories);
router.post("/", requirePermission("products", "create"), createCategory);
router.put("/:categoryId", requirePermission("products", "edit"), updateCategory);
router.post("/:categoryId/image", requirePermission("products", "edit"), productImageUpload.single("image"), uploadCategoryImage);
router.delete("/:categoryId", requirePermission("products", "delete"), deleteCategory);
router.patch("/:categoryId/status", requirePermission("products", "edit"), setCategoryStatus);

router.post("/subcategories", requirePermission("products", "create"), createSubcategory);
router.patch("/subcategories/:subcategoryId/status", requirePermission("products", "edit"), setSubcategoryStatus);

export default router;
