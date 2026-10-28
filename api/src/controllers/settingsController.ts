import { Request, Response } from "express";
import { VisibilitySettings, DEFAULT_VISIBILITY_SETTINGS } from "../models";
import { logAudit } from "../utils/audit";

export async function getVisibilitySettings(req: Request, res: Response) {
  try {
    const ownerId = req.auth!.ownerId;
    const shopId = req.auth!.shopId || 1;

    const row = await VisibilitySettings.findOne({
      where: { owner_id: ownerId, shop_id: shopId },
    });

    if (!row) {
      return res.json({
        success: true,
        data: {
          ownerId,
          shopId,
          settings: DEFAULT_VISIBILITY_SETTINGS,
          isDefault: true,
        },
      });
    }

    // Merge in case any new keys were added since the row was created
    const mergedSettings = { ...DEFAULT_VISIBILITY_SETTINGS, ...row.settings };

    return res.json({
      success: true,
      data: {
        ownerId,
        shopId,
        settings: mergedSettings,
        isDefault: false,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateVisibilitySettings(req: Request, res: Response) {
  try {
    const isOwner = req.auth!.isOwner;
    // Rule: Staff members must not be able to bypass owner-configured restrictions or change settings.
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Only authorized owners or administrators can change visibility settings.",
      });
    }

    const ownerId = req.auth!.ownerId;
    const shopId = req.auth!.shopId || 1;
    const incoming = req.body.settings;

    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid settings payload. Expected settings object.",
      });
    }

    // Merge incoming with default settings so all required keys are guaranteed present
    const updatedSettings: Record<string, boolean> = { ...DEFAULT_VISIBILITY_SETTINGS };
    for (const key of Object.keys(DEFAULT_VISIBILITY_SETTINGS)) {
      if (typeof incoming[key] === "boolean") {
        updatedSettings[key] = incoming[key];
      }
    }

    // Ensure at least one bottom navigation item is enabled
    const hasNav =
      updatedSettings.nav_home ||
      updatedSettings.nav_bills ||
      updatedSettings.nav_ledger ||
      updatedSettings.nav_catalog ||
      updatedSettings.nav_orders;

    if (!hasNav) {
      updatedSettings.nav_home = true; // Fallback to Home if all disabled
    }

    const [row] = await VisibilitySettings.upsert({
      owner_id: ownerId,
      shop_id: shopId,
      settings: updatedSettings as any,
    });

    await logAudit({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function resetVisibilitySettings(req: Request, res: Response) {
  try {
    const isOwner = req.auth!.isOwner;
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Only authorized owners can reset visibility settings.",
      });
    }

    const ownerId = req.auth!.ownerId;
    const shopId = req.auth!.shopId || 1;

    const [row] = await VisibilitySettings.upsert({
      owner_id: ownerId,
      shop_id: shopId,
      settings: DEFAULT_VISIBILITY_SETTINGS,
    });

    await logAudit({
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
        settings: DEFAULT_VISIBILITY_SETTINGS,
        isDefault: true,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
