import type { Product, ProductVisibility } from "../types";

/** Badge text, meaning and colours for each visibility. Mirrors api/src/utils/productVisibility.ts. */
export const VISIBILITY_META: Record<ProductVisibility, { badge: string; label: string; hint: string; cls: string; dot: string }> = {
  both: {
    badge: "BOTH",
    label: "Marketplace + POS",
    hint: "Customers can order it online and it can be billed at the counter",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  marketplace: {
    badge: "MKT",
    label: "Marketplace only",
    hint: "Shown to customers online, not offered in POS billing",
    cls: "bg-sky-50 text-sky-700 ring-sky-600/20",
    dot: "bg-sky-500",
  },
  pos: {
    badge: "POS",
    label: "POS billing only",
    hint: "Billed at the counter, hidden from the marketplace",
    cls: "bg-violet-50 text-violet-700 ring-violet-600/20",
    dot: "bg-violet-500",
  },
  hidden: {
    badge: "HIDE",
    label: "Hidden",
    hint: "Not in the marketplace or POS billing; still in Product Management",
    cls: "bg-slate-100 text-slate-600 ring-slate-500/20",
    dot: "bg-slate-400",
  },
};

export const VISIBILITY_ORDER: ProductVisibility[] = ["both", "marketplace", "pos", "hidden"];

/** What the SHOW column displays. A deactivated product (status inactive) counts as hidden. */
export function effectiveVisibility(p: Pick<Product, "status" | "visibility">): ProductVisibility {
  if (p.status === "inactive") return "hidden";
  return p.visibility && p.visibility in VISIBILITY_META ? p.visibility : "both";
}

export const isPosVisible = (p: Pick<Product, "status" | "visibility">) => {
  const v = effectiveVisibility(p);
  return v === "both" || v === "pos";
};

export const isMarketplaceVisible = (p: Pick<Product, "status" | "visibility">) => {
  const v = effectiveVisibility(p);
  return v === "both" || v === "marketplace";
};

/**
 * Fields to send to the existing product update API for a new visibility.
 * Picking a visible option on a deactivated product also re-activates it.
 */
export function visibilityPatch(p: Pick<Product, "status">, next: ProductVisibility): Partial<Product> {
  return next !== "hidden" && p.status === "inactive" ? { visibility: next, status: "active" } : { visibility: next };
}
