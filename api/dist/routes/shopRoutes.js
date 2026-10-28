"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const shopController_1 = require("../controllers/shopController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/", shopController_1.listShops); // owner: all shops | employee: assigned shops
router.post("/", auth_1.requireOwner, shopController_1.createShop);
router.post("/switch", shopController_1.switchShop);
router.get("/:shopId", shopController_1.getShop);
router.put("/:shopId", auth_1.requireOwner, shopController_1.updateShop);
router.patch("/:shopId/status", auth_1.requireOwner, shopController_1.toggleShopStatus);
router.delete("/:shopId", auth_1.requireOwner, shopController_1.deleteShop);
exports.default = router;
//# sourceMappingURL=shopRoutes.js.map