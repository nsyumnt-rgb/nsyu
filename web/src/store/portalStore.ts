import { create } from "zustand";

const PORTAL_STORAGE_KEY = "nsyu.customer.session";

export interface PortalCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  currentBalance: number;
  shop: {
    id: number;
    name: string;
    code: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export interface CartItem {
  id: number;
  productId: number;
  name: string;
  sku: string;
  brand?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  taxAmount: number;
  lineTotal: number;
  availableStock: number;
  warning?: string;
  isUnavailable?: boolean;
}

export interface CartData {
  cartId: number;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  estimatedTotal: number;
  itemCount: number;
}

interface StoredPortalSession {
  accessToken: string;
  refreshToken: string;
  customer: PortalCustomer;
}

function loadStoredPortalSession(): StoredPortalSession | null {
  try {
    const raw = localStorage.getItem(PORTAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface PortalState {
  accessToken: string | null;
  refreshToken: string | null;
  customer: PortalCustomer | null;
  unreadCount: number;
  cart: CartData | null;
  cartLoading: boolean;

  setCustomerSession: (accessToken: string, refreshToken: string, customer: PortalCustomer) => void;
  setAccessToken: (accessToken: string) => void;
  updateCustomerProfile: (data: Partial<PortalCustomer>) => void;
  setUnreadCount: (count: number) => void;
  setCart: (cart: CartData) => void;
  setCartLoading: (loading: boolean) => void;
  logoutCustomer: () => void;
}

const stored = loadStoredPortalSession();

export const usePortalStore = create<PortalState>((set) => ({
  accessToken: stored?.accessToken ?? null,
  refreshToken: stored?.refreshToken ?? null,
  customer: stored?.customer ?? null,
  unreadCount: 0,
  cart: null,
  cartLoading: false,

  setCustomerSession: (accessToken, refreshToken, customer) => {
    localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, customer }));
    set({ accessToken, refreshToken, customer });
  },

  setAccessToken: (accessToken) => {
    const current = loadStoredPortalSession();
    if (current) {
      localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify({ ...current, accessToken }));
    }
    set({ accessToken });
  },

  updateCustomerProfile: (data) =>
    set((state) => {
      if (!state.customer) return state;
      const updated = { ...state.customer, ...data };
      const current = loadStoredPortalSession();
      if (current) {
        localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify({ ...current, customer: updated }));
      }
      return { customer: updated };
    }),

  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setCart: (cart) => set({ cart }),
  setCartLoading: (cartLoading) => set({ cartLoading }),

  logoutCustomer: () => {
    localStorage.removeItem(PORTAL_STORAGE_KEY);
    set({ accessToken: null, refreshToken: null, customer: null, cart: null, unreadCount: 0 });
  },
}));

