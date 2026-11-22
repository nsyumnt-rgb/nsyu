import type { Product } from "../types";

const time = (d?: string | null) => {
  const t = d ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * When a product last changed: its own edit (name, price, status…) or a stock
 * change in any shop row we loaded, whichever is newest.
 */
export function productLastChanged(p: Pick<Product, "created_at" | "updated_at" | "stocks">): number {
  let latest = Math.max(time(p.updated_at), time(p.created_at));
  for (const s of p.stocks ?? []) latest = Math.max(latest, time(s.updated_at));
  return latest;
}

/** Most recently added or changed products first. */
export const byRecentChange = (a: Product, b: Product) => productLastChanged(b) - productLastChanged(a);
