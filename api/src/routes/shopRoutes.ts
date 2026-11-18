import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import { bannerImageUpload } from "../middleware/upload";
import {
  createShop,
  listShops,
  getShop,
  updateShop,
  toggleShopStatus,
  deleteShop,
  switchShop,
  getShopPortalSettings,
  updateShopPortalSettings,
  getShopSettings,
  updateShopSettings,
  uploadShopBanner,
  deleteShopBanner,
} from "../controllers/shopController";

const router = Router();

router.use(authenticate);

router.get("/", listShops); // owner: all shops | employee: assigned shops
router.post("/", requireOwner, createShop);
router.post("/switch", switchShop);
router.get("/:shopId", getShop);
router.put("/:shopId", requireOwner, updateShop);
router.get("/:shopId/settings", getShopSettings);
router.put("/:shopId/settings", requireOwner, updateShopSettings);
router.get("/:shopId/portal-settings", getShopPortalSettings);
router.put("/:shopId/portal-settings", requireOwner, updateShopPortalSettings);
router.patch("/:shopId/status", requireOwner, toggleShopStatus);
router.delete("/:shopId", requireOwner, deleteShop);
router.post("/:shopId/banner", requireOwner, bannerImageUpload.single("banner"), uploadShopBanner);
router.delete("/:shopId/banner", requireOwner, deleteShopBanner);

export default router;

