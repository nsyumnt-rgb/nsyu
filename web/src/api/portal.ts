import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getApiBaseUrl } from "./client";
import { usePortalStore, type CartData, type PortalCustomer } from "../store/portalStore";

export const portalApi = axios.create({ baseURL: getApiBaseUrl() });

portalApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseUrl();
  const token = usePortalStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function performPortalRefresh(): Promise<string | null> {
  const refreshToken = usePortalStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const currentBase = getApiBaseUrl();
    const res = await axios.post(`${currentBase}/customer-portal/auth/refresh`, { refreshToken });
    const newAccessToken: string = res.data?.data?.accessToken;
    if (newAccessToken) {
      usePortalStore.getState().setAccessToken(newAccessToken);
      return newAccessToken;
    }
    return null;
  } catch {
    return null;
  }
}

portalApi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshPromise) {
        refreshPromise = performPortalRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return portalApi(original);
      }
      usePortalStore.getState().logoutCustomer();
    }
    return Promise.reject(error);
  }
);

/* ---------------- Auth API ---------------- */
export async function requestOtpApi(identifier: string, shopCode?: string, shopId?: number) {
  const isEmail = identifier.includes("@");
  const payload: any = { identifier, shopCode, shopId };
  if (isEmail) {
    payload.email = identifier;
  } else {
    payload.phone = identifier;
  }
  const res = await portalApi.post("/customer-portal/auth/request-otp", payload);
  return res.data;
}

export async function verifyOtpApi(identifier: string, otp: string, shopCode?: string, shopId?: number) {
  const isEmail = identifier.includes("@");
  const payload: any = { identifier, otp, shopCode, shopId };
  if (isEmail) {
    payload.email = identifier;
  } else {
    payload.phone = identifier;
  }
  const res = await portalApi.post("/customer-portal/auth/verify-otp", payload);
  return res.data;
}

export async function logoutCustomerApi() {
  const refreshToken = usePortalStore.getState().refreshToken;
  try {
    await portalApi.post("/customer-portal/auth/logout", { refreshToken });
  } catch {}
  usePortalStore.getState().logoutCustomer();
}

/* ---------------- Catalog & Cart ---------------- */
export async function getPortalCategoriesApi() {
  const res = await portalApi.get("/customer-portal/catalog/categories");
  return res.data?.data || [];
}

export async function getPortalProductsApi(params?: { search?: string; categoryId?: number; page?: number; limit?: number }) {
  const res = await portalApi.get("/customer-portal/catalog/products", { params });
  return res.data;
}

export async function getPortalProductApi(id: number) {
  const res = await portalApi.get(`/customer-portal/catalog/products/${id}`);
  return res.data?.data;
}

export async function getCartApi(): Promise<CartData> {
  const res = await portalApi.get("/customer-portal/cart");
  return res.data?.data;
}

export async function setCartItemApi(productId: number, quantity: number): Promise<CartData> {
  const res = await portalApi.put(`/customer-portal/cart/items/${productId}`, { quantity });
  return res.data?.data;
}

export async function removeCartItemApi(productId: number): Promise<CartData> {
  const res = await portalApi.delete(`/customer-portal/cart/items/${productId}`);
  return res.data?.data;
}

export async function clearCartApi() {
  const res = await portalApi.delete("/customer-portal/cart");
  return res.data;
}

/* ---------------- Orders ---------------- */
export async function placeOrderApi(data: { clientRequestId: string; note?: string; deliveryType?: string; shippingAddress?: string }) {
  const res = await portalApi.post("/customer-portal/orders", data);
  return res.data;
}

export async function listPortalOrdersApi(params?: { status?: string; page?: number; limit?: number }) {
  const res = await portalApi.get("/customer-portal/orders", { params });
  return res.data;
}

export async function getPortalOrderApi(id: number) {
  const res = await portalApi.get(`/customer-portal/orders/${id}`);
  return res.data?.data;
}

export async function cancelPortalOrderApi(id: number) {
  const res = await portalApi.post(`/customer-portal/orders/${id}/cancel`);
  return res.data;
}

/* ---------------- Bills & Ledger ---------------- */
export async function listPortalBillsApi(params?: { status?: string; from?: string; to?: string; page?: number; limit?: number }) {
  const res = await portalApi.get("/customer-portal/bills", { params });
  return res.data;
}

export async function getPortalBillApi(id: number) {
  const res = await portalApi.get(`/customer-portal/bills/${id}`);
  return res.data?.data;
}

export async function listPortalLedgerApi(params?: { from?: string; to?: string; page?: number; limit?: number }) {
  const res = await portalApi.get("/customer-portal/ledger", { params });
  return res.data;
}

export async function getPortalLedgerSummaryApi() {
  const res = await portalApi.get("/customer-portal/ledger/summary");
  return res.data?.data;
}

export async function listPortalPaymentsApi() {
  const res = await portalApi.get("/customer-portal/payments");
  return res.data?.data || [];
}

/* ---------------- Notifications & Profile ---------------- */
export async function listPortalNotificationsApi(params?: { unread?: boolean; page?: number }) {
  const res = await portalApi.get("/customer-portal/notifications", { params });
  return res.data;
}

export async function getPortalUnreadCountApi() {
  const res = await portalApi.get("/customer-portal/notifications/unread-count");
  return res.data?.count || 0;
}

export async function markPortalNotificationReadApi(id: number) {
  const res = await portalApi.patch(`/customer-portal/notifications/${id}/read`);
  return res.data;
}

export async function markAllPortalNotificationsReadApi() {
  const res = await portalApi.post("/customer-portal/notifications/read-all");
  return res.data;
}

export async function getPortalProfileApi(): Promise<PortalCustomer> {
  const res = await portalApi.get("/customer-portal/me");
  return res.data?.data;
}

export async function updatePortalProfileApi(data: { email?: string; address?: string }) {
  const res = await portalApi.patch("/customer-portal/me", data);
  return res.data;
}

