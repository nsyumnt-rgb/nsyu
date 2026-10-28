"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisibilitySettings = getVisibilitySettings;
exports.updateVisibilitySettings = updateVisibilitySettings;
exports.resetVisibilitySettings = resetVisibilitySettings;
const models_1 = require("../models");
const audit_1 = require("../utils/audit");
async function getVisibilitySettings(req, res) {
    try {
        const ownerId = req.auth.ownerId;
        const shopId = req.auth.shopId || 1;
        const row = await models_1.VisibilitySettings.findOne({
            where: { owner_id: ownerId, shop_id: shopId },
        });
        if (!row) {
            return res.json({
                success: true,
                data: {
                    ownerId,
                    shopId,
                    settings: models_1.DEFAULT_VISIBILITY_SETTINGS,
                    isDefault: true,
                },
            });
        }
        // Merge in case any new keys were added since the row was created
        const mergedSettings = { ...models_1.DEFAULT_VISIBILITY_SETTINGS, ...row.settings };
        return res.json({
            success: true,
            data: {
                ownerId,
                shopId,
                settings: mergedSettings,
                isDefault: false,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
async function updateVisibilitySettings(req, res) {
    try {
        const isOwner = req.auth.isOwner;
        // Rule: Staff members must not be able to bypass owner-configured restrictions or change settings.
        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: "Only authorized owners or administrators can change visibility settings.",
            });
        }
        const ownerId = req.auth.ownerId;
        const shopId = req.auth.shopId || 1;
        const incoming = req.body.settings;
        if (!incoming || typeof incoming !== "object") {
            return res.status(400).json({
                success: false,
                message: "Invalid settings payload. Expected settings object.",
            });
        }
        // Merge incoming with default settings so all required keys are guaranteed present
        const updatedSettings = { ...models_1.DEFAULT_VISIBILITY_SETTINGS };
        for (const key of Object.keys(models_1.DEFAULT_VISIBILITY_SETTINGS)) {
            if (typeof incoming[key] === "boolean") {
                updatedSettings[key] = incoming[key];
            }
        }
        // Ensure at least one bottom navigation item is enabled
        const hasNav = updatedSettings.nav_home ||
            updatedSettings.nav_bills ||
            updatedSettings.nav_ledger ||
            updatedSettings.nav_catalog ||
            updatedSettings.nav_orders;
        if (!hasNav) {
            updatedSettings.nav_home = true; // Fallback to Home if all disabled
        }
        const [row] = await models_1.VisibilitySettings.upsert({
            owner_id: ownerId,
            shop_id: shopId,
            settings: updatedSettings,
        });
        await (0, audit_1.logAudit)({
            req,
            module: "shops",
            action: "update",
            entityType: "VisibilitySettings",
            entityId: row.id,
            details: { shopId, updatedKeys: Object.keys(incoming) },
        });
        return res.json({
            success: true,
            message: "Visibility settings saved successfully.",
            data: {
                ownerId,
                shopId,
                settings: updatedSettings,
                isDefault: false,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
async function resetVisibilitySettings(req, res) {
    try {
        const isOwner = req.auth.isOwner;
        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: "Only authorized owners can reset visibility settings.",
            });
        }
        const ownerId = req.auth.ownerId;
        const shopId = req.auth.shopId || 1;
        const [row] = await models_1.VisibilitySettings.upsert({
            owner_id: ownerId,
            shop_id: shopId,
            settings: models_1.DEFAULT_VISIBILITY_SETTINGS,
        });
        await (0, audit_1.logAudit)({
            req,
            module: "shops",
            action: "update",
            entityType: "VisibilitySettings",
            entityId: row.id,
            details: { shopId, action: "reset_to_default" },
        });
        return res.json({
            success: true,
            message: "Visibility settings reset to default values.",
            data: {
                ownerId,
                shopId,
                settings: models_1.DEFAULT_VISIBILITY_SETTINGS,
                isDefault: true,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
//# sourceMappingURL=settingsController.js.map