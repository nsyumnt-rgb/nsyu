import { api } from "./client";
import type { ApiEnvelope, InventoryTransaction, MovementType, ProductStockEntry, StockTransfer } from "../types";

export type DirectMovementType = Exclude<MovementType, "opening" | "transfer_in" | "transfer_out">;

export function recordMovement(payload: {
  productId: number;
  type: DirectMovementType;
  quantity: number;
  notes?: string;
  shopId?: number;
  /** Stock shown on screen; the server refuses (409) if the real stock differs. */
  expectedStock?: number;
}) {
  return api.post<ApiEnvelope<{ currentStock?: number; stock?: { current_stock: number }; transaction: InventoryTransaction }>>("/inventory/movement", payload);
}

export type TransferStatus = "pending" | "in_transit" | "completed" | "cancelled";

/**
 * Move stock between two of the owner's shops.
 * status "completed" moves it at once; "in_transit" takes it out of the source now;
 * "pending" moves nothing until it is dispatched.
 */
export function transferStock(payload: {
  fromShopId: number;
  toShopId: number;
  items: { productId: number; quantity: number }[];
  status?: Exclude<TransferStatus, "cancelled">;
  notes?: string;
}) {
  return api.post<ApiEnvelope<StockTransfer>>("/inventory/transfers", payload);
}

export function dispatchTransfer(id: number) {
  return api.put<ApiEnvelope<StockTransfer>>(`/inventory/transfers/${id}/dispatch`, {});
}

export function receiveTransfer(id: number) {
  return api.put<ApiEnvelope<StockTransfer>>(`/inventory/transfers/${id}/receive`, {});
}

export function cancelTransfer(id: number, reason?: string) {
  return api.put<ApiEnvelope<StockTransfer>>(`/inventory/transfers/${id}/cancel`, { reason });
}

export function getInventoryHistory(params?: { productId?: number; shopId?: number; type?: MovementType; limit?: number }) {
  return api.get<ApiEnvelope<InventoryTransaction[]>>("/inventory/history", { params });
}

export function getProductStockOverview(productId: number | string) {
  return api.get<ApiEnvelope<ProductStockEntry[]>>(`/inventory/stock/${productId}`);
}

export function getTransfer(transferId: number | string) {
  return api.get<ApiEnvelope<StockTransfer & { transactions?: any[] }>>(`/inventory/transfers/${transferId}`);
}

export function listTransfers(params?: {
  status?: string;
  shopId?: number | string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  return api.get<ApiEnvelope<{
    transfers: StockTransfer[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    metrics: {
      totalTransfers: number;
      totalItemsTransferred: number;
      pendingTransfers: number;
      completedTransfers: number;
    };
    monthlyTrends: { month: string; transfers: number; items: number }[];
    recentTransfers: StockTransfer[];
  }>>("/inventory/transfers", { params });
}

export function getMovement(movementId: number | string) {
  return api.get<ApiEnvelope<InventoryTransaction>>(`/inventory/movement/${movementId}`);
}

