import { create } from "zustand";

const WISHLIST_STORAGE_KEY = "nsyu.market.wishlist";

interface StoredWishlist {
  products: number[];
  shops: string[];
}

function loadStoredWishlist(): StoredWishlist {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return { products: [], shops: [] };
    const parsed = JSON.parse(raw);
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      shops: Array.isArray(parsed.shops) ? parsed.shops : [],
    };
  } catch {
    return { products: [], shops: [] };
  }
}

interface WishlistState {
  productIds: number[];
  shopCodes: string[];
  toggleProduct: (productId: number) => void;
  hasProduct: (productId: number) => boolean;
  toggleShop: (shopCode: string) => void;
  hasShop: (shopCode: string) => boolean;
  totalCount: number;
}

const initial = loadStoredWishlist();

export const useWishlistStore = create<WishlistState>((set, get) => ({
  productIds: initial.products,
  shopCodes: initial.shops,
  totalCount: initial.products.length + initial.shops.length,

  toggleProduct: (productId: number) => {
    const { productIds, shopCodes } = get();
    const next = productIds.includes(productId)
      ? productIds.filter((id) => id !== productId)
      : [...productIds, productId];
    localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify({ products: next, shops: shopCodes })
    );
    set({ productIds: next, totalCount: next.length + shopCodes.length });
  },

  hasProduct: (productId: number) => get().productIds.includes(productId),

  toggleShop: (shopCode: string) => {
    const { productIds, shopCodes } = get();
    const next = shopCodes.includes(shopCode)
      ? shopCodes.filter((code) => code !== shopCode)
      : [...shopCodes, shopCode];
    localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify({ products: productIds, shops: next })
    );
    set({ shopCodes: next, totalCount: productIds.length + next.length });
  },

  hasShop: (shopCode: string) => get().shopCodes.includes(shopCode),
}));
