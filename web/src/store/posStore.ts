import { create } from "zustand";

/**
 * Tiny bridge between the Sales (POS) screen and the top bar: the Sales page
 * publishes how many items are in the current bill, and the top-bar cart
 * button opens the bill drawer. Nothing is persisted.
 */
interface PosState {
  /** Total quantity in the current bill, or null when the Sales screen isn't open. */
  count: number | null;
  open: boolean;
  setCount: (n: number | null) => void;
  setOpen: (v: boolean) => void;
}

export const usePosStore = create<PosState>((set) => ({
  count: null,
  open: false,
  setCount: (count) => set({ count }),
  setOpen: (open) => set({ open }),
}));
