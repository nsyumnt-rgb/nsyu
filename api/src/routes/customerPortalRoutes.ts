import { Router } from "express";
import { requireCustomer } from "../middleware/auth";
import {
  requestOtp,
  verifyOtp,
  refreshCustomerToken,
  logoutCustomer,
  selfRegisterCustomer,
} from "../controllers/customerAuthController";
import {
  getPortalCategories,
  getPortalProducts,
  getPortalProduct,
} from "../controllers/customerCatalogController";
import {
  getCart,
  setCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/customerCartController";
import {
  placeOrder,
  listPortalOrders,
  getPortalOrder,
  cancelPortalOrder,
} from "../controllers/customerOrderController";
import {
  listPortalBills,
  getPortalBill,
  downloadPortalBillPdf,
  listPortalLedger,
  getPortalLedgerSummary,
  listPortalPayments,
  listPortalNotifications,
  getPortalUnreadCount,
  markPortalNotificationRead,
  markAllPortalNotificationsRead,
  getPortalProfile,
  updatePortalProfile,
} from "../controllers/customerFinancialsController";

const router = Router();

/* ---------------- Auth (Public) ---------------- */
router.post("/auth/request-otp", requestOtp);
router.post("/auth/verify-otp", verifyOtp);
router.post("/auth/refresh", refreshCustomerToken);
router.post("/auth/logout", logoutCustomer);
router.post("/auth/register", selfRegisterCustomer);

/* ---------------- Protected Customer Routes ---------------- */
router.use(requireCustomer);

// Catalog
router.get("/catalog/categories", getPortalCategories);
router.get("/catalog/products", getPortalProducts);
router.get("/catalog/products/:id", getPortalProduct);

// Cart
router.get("/cart", getCart);
router.put("/cart/items/:productId", setCartItem);
router.delete("/cart/items/:productId", removeCartItem);
router.delete("/cart", clearCart);

// Orders
router.post("/orders", placeOrder);
router.get("/orders", listPortalOrders);
router.get("/orders/:id", getPortalOrder);
router.post("/orders/:id/cancel", cancelPortalOrder);

// Bills
router.get("/bills", listPortalBills);
router.get("/bills/:id", getPortalBill);
router.get("/bills/:id/pdf", downloadPortalBillPdf);

// Ledger & Payments
router.get("/ledger", listPortalLedger);
router.get("/ledger/summary", getPortalLedgerSummary);
router.get("/payments", listPortalPayments);

// Notifications
router.get("/notifications", listPortalNotifications);
router.get("/notifications/unread-count", getPortalUnreadCount);
router.patch("/notifications/:id/read", markPortalNotificationRead);
router.post("/notifications/read-all", markAllPortalNotificationsRead);

// Profile
router.get("/me", getPortalProfile);
router.patch("/me", updatePortalProfile);

export default router;

