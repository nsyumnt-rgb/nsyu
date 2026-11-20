import { api } from "./client";
import type { ApiEnvelope } from "../types";

export interface ResolvedReference {
  type: "sale" | "purchase" | "payment" | "product" | "customer" | "supplier" | "employee" | "emi" | "payroll";
  id: number | string;
  reference: string;
  route: string;
  title: string;
  record?: any;
}

export function resolveReferenceApi(ref: string) {
  return api.get<ApiEnvelope<ResolvedReference>>("/reference/resolve", {
    params: { ref },
  });
}
