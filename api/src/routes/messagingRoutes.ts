import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { authenticate, requireShop } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import * as m from "../controllers/messagingController";

const router = Router();

/* ---------- Public (no login): Meta webhook + customer preference links ---------- */
router.get("/webhooks/whatsapp", m.verifyWebhook);
router.post("/webhooks/whatsapp", m.receiveWebhook);
router.get("/public/preferences/:token", m.getPublicPreferences);
router.put("/public/preferences/:token", m.updatePublicPreferences);

/* ---------- Attachments (PDF / images) ---------- */
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "messaging");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, UPLOAD_DIR),
    filename: (_r, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_r, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) return cb(new Error("Attachments must be PDF, JPG, PNG or WEBP (max 5 MB)"));
    cb(null, true);
  },
});

/* ---------- Shop staff ---------- */
router.use(authenticate, requireShop);

const view = requirePermission("customers", "view");
const send = requirePermission("customers", "edit");
const configure = requirePermission("shop_settings", "edit");

router.get("/overview", view, m.getOverview);
router.get("/settings", view, m.getSettings);
router.put("/settings/whatsapp", configure, m.updateWhatsAppSettings);
router.post("/settings/whatsapp/verify", configure, m.verifyWhatsApp);
router.post("/settings/whatsapp/test", configure, m.sendTestWhatsApp);
router.get("/settings/whatsapp/templates", view, m.listWhatsAppTemplates);
router.put("/settings/email", configure, m.updateEmailSettings);
router.post("/settings/email/test", configure, m.sendTestEmail);
router.put("/automations", configure, m.updateAutomations);

router.get("/templates", view, m.listTemplates);
router.post("/templates", send, m.createTemplate);
router.put("/templates/:id", send, m.updateTemplate);
router.delete("/templates/:id", send, m.deleteTemplate);
router.post("/attachments", send, upload.single("file"), m.uploadAttachment);

router.get("/customers", view, m.searchCustomers);
router.get("/customers/:customerId/preferences", view, m.getCustomerPreferences);
router.put("/customers/:customerId/preferences", send, m.updateCustomerPreferences);
router.post("/audience/preview", view, m.previewAudience);
router.post("/preview", view, m.previewMessage);
router.post("/send", send, m.sendMessage);

router.get("/campaigns", view, m.listCampaigns);
router.get("/campaigns/:id", view, m.getCampaign);
router.post("/campaigns/:id/cancel", send, m.cancelCampaign);
router.get("/history", view, m.getHistory);
router.post("/deliveries/:id/retry", send, m.retryDelivery);

export default router;
