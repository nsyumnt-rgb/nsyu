/**
 * UI feature flags. Flipping a flag only changes navigation — the routes and
 * pages behind it keep working either way.
 */
export const FEATURES = {
  /**
   * Show "Orders" in the sidebar and mobile bottom bar.
   * Off while the shop runs counter billing only; /app/orders still works.
   * Turn it on when online orders start coming in.
   */
  showOrdersMenu: false,
} as const;
