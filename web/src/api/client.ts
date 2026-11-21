import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";

export const DEFAULT_CLOUD_API_URL = "https://nsyu-backend-api.onrender.com/api";
export const DEFAULT_LOCAL_API_URL = "http://localhost:5000/api";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isProductionHost =
      hostname.includes("nsyu.in") ||
      hostname.includes("github.io") ||
      hostname.includes("vercel.app");
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const saved = localStorage.getItem("nsyu_api_url");

    if (saved && saved.trim()) {
      // If user opened Production domain on phone or laptop but localStorage still has old localhost URL,
      // reset it to the 24/7 cloud backend URL so they never see localhost connection errors
      if (isProductionHost && (saved.includes("localhost") || saved.includes("127.0.0.1"))) {
        localStorage.removeItem("nsyu_api_url");
        return import.meta.env.VITE_API_URL || DEFAULT_CLOUD_API_URL;
      }
      return saved.trim();
    }

    if (isLocalhost) {
      return import.meta.env.VITE_API_URL || DEFAULT_LOCAL_API_URL;
    }
  }
  return import.meta.env.VITE_API_URL || DEFAULT_CLOUD_API_URL;
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("nsyu_api_url", url.trim());
    api.defaults.baseURL = url.trim();
  }
}

export const api = axios.create({ baseURL: getApiBaseUrl() });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseUrl();
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queue concurrent requests while a single refresh call is in flight,
// so we don't fire /auth/refresh once per failed request.
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const currentBase = getApiBaseUrl();
    const res = await axios.post(`${currentBase}/auth/refresh`, { refreshToken });
    const newAccessToken: string = res.data?.data?.accessToken;
    if (newAccessToken) {
      // Refreshing intentionally drops shop/role context (backend
      // re-issues shopId: null for safety) — the store + route guard
      // send the user back to shop selection when that happens.
      useAuthStore.getState().setAccessToken(newAccessToken, null, null, null);
      return newAccessToken;
    }
    return null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const details = data.errors
        .map((e: any) => e.message || e.msg || e.field)
        .filter(Boolean)
        .join("; ");
      if (details) return `${data.message || "Validation failed"}: ${details}`;
    }
    return data?.message || fallback;
  }
  return fallback;
}

/**
 * Resolve an asset URL returned by the API. Uploaded files are stored as relative
 * paths (e.g. "/uploads/products/x.jpg") served by the API host, not the web host.
 */
export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = getApiBaseUrl().replace(/\/api\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
