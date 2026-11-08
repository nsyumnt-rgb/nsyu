import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  inviteCustomerToPortal,
  disableCustomerPortal,
  enableCustomerPortal,
  listPortalRequests,
  approvePortalRequest,
  rejectPortalRequest,
} from "../controllers/customerController";

const router = Router();

router.use(authenticate, requireShop);

router.get("/portal-requests", requirePermission("customers", "view"), listPortalRequests);
router.post("/portal-requests/:id/approve", requirePermission("customers", "edit"), approvePortalRequest);
router.post("/portal-requests/:id/reject", requirePermission("customers", "edit"), rejectPortalRequest);

router.get("/", requirePermission("customers", "view"), listCustomers);
router.get("/:customerId", requirePermission("customers", "view"), getCustomer);
router.post("/", requirePermission("customers", "create"), createCustomer);
router.put("/:customerId", requirePermission("customers", "edit"), updateCustomer);

router.post("/:customerId/portal/invite", requirePermission("customers", "edit"), inviteCustomerToPortal);
router.post("/:customerId/portal/disable", requirePermission("customers", "edit"), disableCustomerPortal);
router.post("/:customerId/portal/enable", requirePermission("customers", "edit"), enableCustomerPortal);

export default router;
