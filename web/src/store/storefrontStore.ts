import { create } from "zustand";

/* Customer storefront UI state.
   - Wishlist: product ids saved per shop + customer in this browser (no DB table exists for
     wishlists; this keeps the schema unchanged). Every product shown is still fetched live.
   - Cart drawer open/close and a "bump" counter that animates the cart badge after an add. */

const keyFor = (shopId?: number, customerId?: number) => (shopId && customerId ? `nsyu.wishlist.${shopId}.${customerId}` : null);

function read(key: string | null): number[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function write(key: string | null, ids: number[]) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage unavailable (private mode) — wishlist stays in memory for this visit */
  }
}

interface StorefrontState {
  wishlistKey: string | null;
  wishlist: number[];
  cartOpen: boolean;
  cartBump: number;
  bindWishlist: (shopId?: number, customerId?: number) => void;
  toggleWishlist: (productId: number) => void;
  removeFromWishlist: (productId: number) => void;
  openCart: () => void;
  closeCart: () => void;
  bumpCart: () => void;
}

export const useStorefront = create<StorefrontState>((set, get) => ({
  wishlistKey: null,
  wishlist: [],
  cartOpen: false,
  cartBump: 0,

  bindWishlist: (shopId, customerId) => {
    const key = keyFor(shopId, customerId);
    if (key === get().wishlistKey) return;
    set({ wishlistKey: key, wishlist: read(key) });
  },
  toggleWishlist: (productId) => {
    const { wishlist, wishlistKey } = get();
    const next = wishlist.includes(productId) ? wishlist.filter((id) => id !== productId) : [productId, ...wishlist];
    write(wishlistKey, next);
    set({ wishlist: next });
  },
  removeFromWishlist: (productId) => {
    const { wishlist, wishlistKey } = get();
    const next = wishlist.filter((id) => id !== productId);
    write(wishlistKey, next);
    set({ wishlist: next });
  },
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  bumpCart: () => set((s) => ({ cartBump: s.cartBump + 1 })),
}));

/** Small "fly to cart" animation from a product image to the header cart button. */
export function flyToCart(fromEl: Element | null) {
  try {
    if (!fromEl || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]")).filter((el) => el.offsetParent !== null);
    const target = targets[0];
    if (!target) return;
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dot = document.createElement("div");
    const size = 22;
    Object.assign(dot.style, {
      position: "fixed",
      left: `${a.left + a.width / 2 - size / 2}px`,
      top: `${a.top + a.height / 2 - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "9999px",
      background: "#059669",
      boxShadow: "0 6px 16px -4px rgba(4,120,87,.55)",
      zIndex: "100",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    document.body.appendChild(dot);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = dot.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(1.1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.6 },
      ],
      { duration: 650, easing: "cubic-bezier(.4,.0,.2,1)" }
    );
    anim.onfinish = () => dot.remove();
  } catch {
    /* purely decorative */
  }
}
