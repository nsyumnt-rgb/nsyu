import { Router } from "express";
import { authenticate, requireOwner } from "../middleware/auth";
import {
  createShop,
  listShops,
  getShop,
  updateShop,
  toggleShopStatus,
  deleteShop,
  switchShop,
} from "../controllers/shopController";

const router = Router();

router.use(authenticate);

router.get("/", listShops); // owner: all shops | employee: assigned shops
router.post("/", requireOwner, createShop);
router.post("/switch", switchShop);
router.get("/:shopId", getShop);
router.put("/:shopId", requireOwner, updateShop);
router.patch("/:shopId/status", requireOwner, toggleShopStatus);
router.delete("/:shopId", requireOwner, deleteShop);

export default router;

