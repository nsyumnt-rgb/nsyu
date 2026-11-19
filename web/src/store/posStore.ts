import { create } from "zustand";

export interface PosCartItem {
  product: any;
  quantity: number;
  unitPrice: number;
}

interface PosState {
  items: PosCartItem[];
  count: number | null;
  open: boolean;
  addItem: (product: any, qty?: number) => void;
  removeItem: (productId: number) => void;
  setItems: (items: PosCartItem[]) => void;
  clearCart: () => void;
  setCount: (n: number | null) => void;
  setOpen: (v: boolean) => void;
}

export const usePosStore = create<PosState>((set, get) => ({
  items: [],
  count: 0,
  open: false,

  addItem: (product, qty = 1) => {
    const current = get().items;
    const existingIndex = current.findIndex((i) => i.product.id === product.id);
    let next: PosCartItem[];
    if (existingIndex >= 0) {
      next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + qty,
      };
    } else {
      next = [
        ...current,
        {
          product,
          quantity: qty,
          unitPrice: Number(product.selling_price || 0),
        },
      ];
    }
    const totalCount = next.reduce((sum, item) => sum + item.quantity, 0);
    set({ items: next, count: totalCount });
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
}));
