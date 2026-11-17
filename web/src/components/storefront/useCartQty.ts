import { useState } from "react";
import { removeCartItemApi, setCartItemApi } from "../../api/portal";
import { usePortalStore } from "../../store/portalStore";

/** Cart quantity helpers shared by storefront pages: reads the live cart, writes through the cart API. */
export function useCartQty() {
  const cart = usePortalStore((s) => s.cart);
  const setCart = usePortalStore((s) => s.setCart);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qtyOf = (productId: number) => cart?.items?.find((i) => i.productId === productId)?.quantity ?? 0;

  async function setQty(productId: number, qty: number) {
    setUpdatingId(productId);
    setError(null);
    try {
      setCart(qty <= 0 ? await removeCartItemApi(productId) : await setCartItemApi(productId, qty));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not update the cart");
    } finally {
      setUpdatingId(null);
    }
  }

  /** Props for <ProductCard>. */
  const cardProps = (product: { id: number }) => ({
    qty: qtyOf(product.id),
    updating: updatingId === product.id,
    onQty: (q: number) => setQty(product.id, q),
  });

  return { qtyOf, setQty, updatingId, error, setError, cardProps };
}
