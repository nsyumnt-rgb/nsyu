import { Op } from "sequelize";

/**
 * Where a product is offered. Stored in products.visibility.
 *   both        — Marketplace / customer portal + POS billing
 *   marketplace — Marketplace / customer portal only
 *   pos         — POS billing only
 *   hidden      — neither (still listed in Product Management)
 *
 * A product with status "inactive" (deactivated) is treated as hidden everywhere.
 */
export const PRODUCT_VISIBILITIES = ["both", "marketplace", "pos", "hidden"] as const;
export type ProductVisibility = (typeof PRODUCT_VISIBILITIES)[number];

export const MARKETPLACE_VISIBLE: ProductVisibility[] = ["both", "marketplace"];
export const POS_VISIBLE: ProductVisibility[] = ["both", "pos"];

export function isProductVisibility(v: unknown): v is ProductVisibility {
  return typeof v === "string" && (PRODUCT_VISIBILITIES as readonly string[]).includes(v);
}

/**
 * Set at startup once the column is confirmed. If the column could not be
 * added, the filters below turn into no-ops so existing queries keep working.
 */
let columnReady = false;
export function setVisibilityColumnReady(ready: boolean) {
  columnReady = ready;
}
export function visibilityColumnReady() {
  return columnReady;
}

/** Sequelize `where` fragment: products customers can see and order online. */
export function marketplaceVisibleWhere(): Record<string, unknown> {
  return columnReady ? { visibility: { [Op.in]: MARKETPLACE_VISIBLE } } : {};
}

/** Raw SQL fragment (leading " AND ") for the same rule; `alias` is the products table alias. */
export function marketplaceVisibleSql(alias = "p"): string {
  return columnReady ? ` AND ${alias}.visibility IN ('both', 'marketplace')` : "";
}

/** True when a product may be sold at the POS counter. */
export function isPosVisible(p: { status?: string | null; visibility?: string | null }): boolean {
  const v = p.visibility || "both";
  // Products explicitly set to marketplace-only or hidden cannot be sold at the POS counter
  if (v === "marketplace" || v === "hidden") return false;
  return true;
}
