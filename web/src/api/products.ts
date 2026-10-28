import { api } from "./client";
import type { ApiEnvelope, CustomerProduct, Product, ProductImage, ProductLocation } from "../types";

export function listProducts() {
  return api.get<ApiEnvelope<Product[]>>("/products");
}

export function getProduct(productId: number | string) {
  return api.get<ApiEnvelope<Product>>(`/products/${productId}`);
}

export interface CreateProductPayload {
  name: string;
  sku: string;
  barcode?: string;
  category_id?: number;
  subcategory_id?: number;
  brand?: string;
  description?: string;
  purchase_price?: number;
  selling_price?: number;
  mrp?: number;
  discount?: number;
  tax_percent?: number;
  min_stock?: number;
  supplier_id?: number;
  opening_stock?: { shopId: number; quantity: number };
}

export function createProduct(payload: CreateProductPayload) {
  return api.post<ApiEnvelope<Product>>("/products", payload);
}

export function updateProduct(productId: number, payload: Partial<Product>) {
  return api.put<ApiEnvelope<Product>>(`/products/${productId}`, payload);
}

export function deleteProduct(productId: number) {
  return api.delete<ApiEnvelope<null>>(`/products/${productId}`);
}

/* ---------------- Images ---------------- */

export function uploadProductImages(productId: number, files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  return api.post<ApiEnvelope<ProductImage[]>>(`/products/${productId}/images`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function replaceProductImage(imageId: number, file: File) {
  const form = new FormData();
  form.append("image", file);
  return api.put<ApiEnvelope<ProductImage>>(`/products/images/${imageId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteProductImage(imageId: number) {
  return api.delete<ApiEnvelope<null>>(`/products/images/${imageId}`);
}

/* ---------------- Location ---------------- */

export function setProductLocation(productId: number, payload: { shopId: number; rack?: string; shelf?: string; bin?: string }) {
  return api.post<ApiEnvelope<ProductLocation>>(`/products/${productId}/location`, payload);
}

export function getProductLocationHistory(productId: number, shopId?: number) {
  return api.get<ApiEnvelope<ProductLocation[]>>(`/products/${productId}/location/history`, {
    params: shopId ? { shopId } : undefined,
  });
}

/* ---------------- Public customer view (no auth) ---------------- */

export function listCustomerProducts(shopId: number) {
  return api.get<ApiEnvelope<CustomerProduct[]>>(`/products/public/shop/${shopId}`);
}
