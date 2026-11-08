"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const customerAuthController_1 = require("../controllers/customerAuthController");
const customerCatalogController_1 = require("../controllers/customerCatalogController");
const customerCartController_1 = require("../controllers/customerCartController");
const customerOrderController_1 = require("../controllers/customerOrderController");
const customerFinancialsController_1 = require("../controllers/customerFinancialsController");
const router = (0, express_1.Router)();
/* ---------------- Auth (Public) ---------------- */
router.post("/auth/request-otp", customerAuthController_1.requestOtp);
router.post("/auth/verify-otp", customerAuthController_1.verifyOtp);
router.post("/auth/refresh", customerAuthController_1.refreshCustomerToken);
router.post("/auth/logout", customerAuthController_1.logoutCustomer);
router.post("/auth/register", customerAuthController_1.selfRegisterCustomer);
/* ---------------- Protected Customer Routes ---------------- */
router.use(auth_1.requireCustomer);
// Catalog
router.get("/catalog/categories", customerCatalogController_1.getPortalCategories);
router.get("/catalog/products", customerCatalogController_1.getPortalProducts);
router.get("/catalog/products/:id", customerCatalogController_1.getPortalProduct);
// Cart
router.get("/cart", customerCartController_1.getCart);
router.put("/cart/items/:productId", customerCartController_1.setCartItem);
router.delete("/cart/items/:productId", customerCartController_1.removeCartItem);
router.delete("/cart", customerCartController_1.clearCart);
// Orders
router.post("/orders", customerOrderController_1.placeOrder);
router.get("/orders", customerOrderController_1.listPortalOrders);
router.get("/orders/:id", customerOrderController_1.getPortalOrder);
router.post("/orders/:id/cancel", customerOrderController_1.cancelPortalOrder);
// Bills
router.get("/bills", customerFinancialsController_1.listPortalBills);
router.get("/bills/:id", customerFinancialsController_1.getPortalBill);
router.get("/bills/:id/pdf", customerFinancialsController_1.downloadPortalBillPdf);
// Ledger & Payments
router.get("/ledger", customerFinancialsController_1.listPortalLedger);
router.get("/ledger/summary", customerFinancialsController_1.getPortalLedgerSummary);
router.get("/payments", customerFinancialsController_1.listPortalPayments);
// Notifications
router.get("/notifications", customerFinancialsController_1.listPortalNotifications);
router.get("/notifications/unread-count", customerFinancialsController_1.getPortalUnreadCount);
router.patch("/notifications/:id/read", customerFinancialsController_1.markPortalNotificationRead);
router.post("/notifications/read-all", customerFinancialsController_1.markAllPortalNotificationsRead);
// Profile
router.get("/me", customerFinancialsController_1.getPortalProfile);
router.patch("/me", customerFinancialsController_1.updatePortalProfile);
exports.default = router;
//# sourceMappingURL=customerPortalRoutes.js.map