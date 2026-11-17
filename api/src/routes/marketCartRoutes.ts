import { Router } from "express";
import { requireCustomer } from "../middleware/auth";
import { getMarketCart, setMarketCartItem, getCheckoutOptions, checkout } from "../controllers/marketCartController";

/** MultiShop cart grouped by shop (signed-in customers). */
const router = Router();
router.use(requireCustomer);

router.get("/cart", getMarketCart);
router.put("/cart/:shopId/items/:productId", setMarketCartItem);
router.get("/checkout/options", getCheckoutOptions);
router.post("/checkout", checkout);

export default router;
