import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PosCartItem {
  product: any;
  quantity: number;
  unitPrice: number;
}

interface PosState {
  items: PosCartItem[];
  count: number;
  open: boolean;
  addItem: (product: any, qty?: number, unitPrice?: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  updateUnitPrice: (productId: number, price: number) => void;
  removeItem: (productId: number) => void;
  setItems: (items: PosCartItem[]) => void;
  clearCart: () => void;
  setCount: (n: number) => void;
  setOpen: (v: boolean) => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      items: [],
      count: 0,
      open: false,

      addItem: (product, qty = 1, unitPrice) => {
        const current = get().items;
        const existingIndex = current.findIndex((i) => i.product.id === product.id);
        const resolvedPrice =
          unitPrice !== undefined
            ? unitPrice
            : Number(product.selling_price || product.live_price || 0);

        let next: PosCartItem[];
        if (existingIndex >= 0) {
          next = [...current];
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + qty,
            unitPrice: unitPrice !== undefined ? unitPrice : next[existingIndex].unitPrice,
          };
        } else {
          next = [
            ...current,
            {
              product,
              quantity: qty,
              unitPrice: resolvedPrice,
            },
          ];
        }
        const totalCount = next.reduce((sum, item) => sum + item.quantity, 0);
        set({ items: next, count: totalCount });
      },

      updateQuantity: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId);
          return;
        }
        const current = get().items;
        const next = current.map((i) =>
          i.product.id === productId ? { ...i, quantity: qty } : i
        );
        const totalCount = next.reduce((sum, item) => sum + item.quantity, 0);
        set({ items: next, count: totalCount });
      },

      updateUnitPrice: (productId, price) => {
        const current = get().items;
        const next = current.map((i) =>
          i.product.id === productId ? { ...i, unitPrice: Math.max(0, price) } : i
        );
        set({ items: next });
      },

      removeItem: (productId) => {
        const next = get().items.filter((i) => i.product.id !== productId);
        const totalCount = next.reduce((sum, item) => sum + item.quantity, 0);
        set({ items: next, count: totalCount });
      },

      setItems: (items) => {
        const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
        set({ items, count: totalCount });
      },

      clearCart: () => set({ items: [], count: 0 }),
      setCount: (count) => set({ count }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "nsyu_pos_cart",
      partialize: (state) => ({ items: state.items, count: state.count }),
    }
  )
);

