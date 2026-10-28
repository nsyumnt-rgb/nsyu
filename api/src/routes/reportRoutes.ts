import { Router } from "express";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { validate, dateRangeQueryRules } from "../middleware/validate";
import {
  salesReport,
  purchaseReport,
  inventoryReport,
  profitReport,
  customerOutstandingReport,
  supplierOutstandingReport,
  emiReport,
  paymentsReport,
  shopPerformanceReport,
  productPerformanceReport,
  attendanceReport,
  salaryReport,
  payrollReport,
  advanceReport,
} from "../controllers/reportController";

const router = Router();

router.use(authenticate, requireShop, requirePermission("reports", "view"), validate(dateRangeQueryRules));

// All support ?from=&to=&shopId= (shopId is owner-only — employees are always pinned to their own shop)
router.get("/sales", salesReport);
router.get("/purchase", purchaseReport);
router.get("/inventory", inventoryReport);
router.get("/profit", profitReport);
router.get("/customer-outstanding", customerOutstandingReport);
router.get("/supplier-outstanding", supplierOutstandingReport);
router.get("/emi", emiReport);
router.get("/payments", paymentsReport);
router.get("/shop-performance", shopPerformanceReport);
router.get("/product-performance", productPerformanceReport);
router.get("/attendance", attendanceReport);
router.get("/salary", salaryReport);
router.get("/payroll", payrollReport);
router.get("/advances", advanceReport);

export default router;
