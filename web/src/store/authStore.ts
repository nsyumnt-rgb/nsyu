import { create } from "zustand";
import type { AccountType, Employee, FieldGrid, ModuleName, Owner, PermissionGrid, Shop } from "../types";

const STORAGE_KEY = "nsyu.session";

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  accountType: AccountType;
}

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  // tokens
  accessToken: string | null;
  refreshToken: string | null;
  accountType: AccountType | null;

  // resolved identity + context (populated by /auth/me)
  owner: Owner | null;
  employee: Employee | null;
  shopId: number | null;
  roleId: number | null;
  roleName: string | null;
  assignedShopIds: number[];
  permissions: PermissionGrid;
  fieldPermissions: FieldGrid;
  activeShop: Shop | null;

  hydrated: boolean;

  // actions
  setSession: (accessToken: string, refreshToken: string, accountType: AccountType) => void;
  setAccessToken: (accessToken: string, shopId: number | null, roleId: number | null, roleName: string | null) => void;
  setMe: (me: {
    owner?: Owner;
    employee?: Employee;
    shopId: number | null;
    roleId: number | null;
    roleName: string | null;
    assignedShopIds?: number[];
    permissions: PermissionGrid;
    fieldPermissions: FieldGrid;
  }) => void;
  setActiveShop: (shop: Shop | null) => void;
  logout: () => void;
  setHydrated: (v: boolean) => void;

  // helpers
  isOwner: () => boolean;
  can: (module: ModuleName, action: "view" | "create" | "edit" | "delete") => boolean;
  canField: (field: string) => boolean;
}

const stored = loadStoredSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: stored?.accessToken ?? null,
  refreshToken: stored?.refreshToken ?? null,
  accountType: stored?.accountType ?? null,

  owner: null,
  employee: null,
  shopId: null,
  roleId: null,
  roleName: null,
  assignedShopIds: [],
  permissions: {},
  fieldPermissions: {},
  activeShop: null,
  hydrated: false,

  setSession: (accessToken, refreshToken, accountType) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, accountType }));
    set({ accessToken, refreshToken, accountType });
  },

  setAccessToken: (accessToken, shopId, roleId, roleName) => {
    const current = loadStoredSession();
    if (current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, accessToken }));
    }
    set({ accessToken, shopId, roleId, roleName });
  },

  setMe: (me) =>
    set({
      owner: me.owner ?? null,
      employee: me.employee ?? null,
      shopId: me.shopId,
      roleId: me.roleId,
      roleName: me.roleName,
      assignedShopIds: me.assignedShopIds ?? [],
      permissions: me.permissions,
      fieldPermissions: me.fieldPermissions,
    }),

  setActiveShop: (shop) => set({ activeShop: shop, shopId: shop?.id ?? null }),

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      accountType: null,
      owner: null,
      employee: null,
      shopId: null,
      roleId: null,
      roleName: null,
      assignedShopIds: [],
      permissions: {},
      fieldPermissions: {},
      activeShop: null,
    });
  },

  setHydrated: (v) => set({ hydrated: v }),

  isOwner: () => get().accountType === "owner",

  can: (module, action) => {
    const state = get();
    if (state.accountType === "owner") return true;
    const grant = state.permissions[module];
    if (!grant) return false;
    const key = (`can_${action}` as const) as keyof typeof grant;
    return Boolean(grant[key]);
  },

  canField: (field) => {
    const state = get();
    if (state.accountType === "owner") return true;
    return Boolean(state.fieldPermissions[field as keyof FieldGrid]);
  },
}));
