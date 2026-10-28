import { api } from "./client";
import type { ApiEnvelope, MeResponse } from "../types";

export interface LoginResult {
  accountType: "owner" | "employee";
  owner?: { id: number; name: string; email: string };
  employee?: { id: number; name: string; email: string };
  assignedShopIds?: number[];
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string) {
  return api.post<ApiEnvelope<LoginResult>>("/auth/login", { email, password });
}

export function registerOwner(payload: { name: string; email: string; password: string; phone?: string }) {
  return api.post<ApiEnvelope<LoginResult>>("/auth/register", payload);
}

export function logout(refreshToken: string) {
  return api.post<ApiEnvelope<null>>("/auth/logout", { refreshToken });
}

export function fetchMe() {
  return api.get<ApiEnvelope<MeResponse>>("/auth/me");
}
