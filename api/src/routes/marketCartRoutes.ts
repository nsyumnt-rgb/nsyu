import { Router } from "express";
import { requireCustomer } from "../middleware/auth";
import { getMarketCart, setMarketCartItem } from "../controllers/marketCartController";

/** MultiShop cart grouped by shop (signed-in customers). */
const router = Router();
router.use(requireCustomer);

router.get("/cart", getMarketCart);
router.put("/cart/:shopId/items/:productId", setMarketCartItem);

export default router;
