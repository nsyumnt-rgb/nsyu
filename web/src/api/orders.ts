import { api } from "./client";
import type { ApiEnvelope } from "../types";

export interface OrderItemPayload {
  productId?: number | null;
  productName: string;
  sku: string;
  quantity: number;
  rate: number;
  discountPercent?: number;
  gstPercent?: number;
  amount?: number;
  availableStock?: number;
}

export interface CreateOrderPayload {
  customerId?: number | null;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  orderDate?: string;
  expectedDeliveryDate?: string;
  orderType?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingAddress?: string;
  discountAmount?: number;
  taxPercent?: number;
  remarks?: string;
  items: OrderItemPayload[];
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

export interface OrderRecord {
  id: number;
  order_number: string;
  order_date: string;
  expected_delivery_date?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  order_type?: string;
  payment_method?: string;
  payment_status?: string;
  shipping_address?: string;
  remarks?: string | null;
  customer_id: number;
  customer?: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  shop?: {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
  };
  items?: Array<{
    id: number;
    order_id: number;
    product_id?: number | null;
    product_name: string;
    sku: string;
    quantity: number;
    rate: number;
    discount_percent: number;
    gst_percent?: number;
    tax_amount?: number;
    amount: number;
  }>;
  created_at: string;
  updated_at: string;
}

export function getOrderStats() {
  return api.get<ApiEnvelope<OrderStats>>("/orders/stats");
}

export function getOrders(params?: {
  status?: string;
  paymentStatus?: string;
  customerId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  return api.get<ApiEnvelope<OrderRecord[]>>("/orders", { params });
}

export function getOrderById(id: number | string) {
  return api.get<ApiEnvelope<OrderRecord>>(`/orders/${id}`);
}

export function createOrder(payload: CreateOrderPayload) {
  return api.post<ApiEnvelope<OrderRecord>>("/orders", payload);
}

export function updateOrderStatus(
  id: number | string,
  payload: { status: string; remarks?: string; payment_status?: string }
) {
  return api.put<ApiEnvelope<OrderRecord>>(`/orders/${id}/status`, payload);
}

export function convertOrderToBill(id: number | string, saleId?: number) {
  return api.post<ApiEnvelope<OrderRecord>>(`/orders/${id}/convert`, { saleId });
}

