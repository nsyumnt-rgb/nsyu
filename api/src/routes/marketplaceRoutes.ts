import { Router } from "express";
import { searchListings, listMarketCategories, listMarketShops, getMarketShop, getListing } from "../controllers/marketplaceController";

/** Public, read-only marketplace endpoints (no authentication). */
const router = Router();

router.get("/products", searchListings);
router.get("/categories", listMarketCategories);
router.get("/shops", listMarketShops);
router.get("/shops/:code", getMarketShop);
router.get("/shops/:shopId/products/:productId", getListing);

export default router;
