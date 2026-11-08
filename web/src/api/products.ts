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

/* ---------------- Bulk Import ---------------- */

export type ImportPreviewStatus = "new" | "existing" | "price_change" | "duplicate" | "invalid" | "ambiguous";

export interface ImportPreviewItem {
  rowIndex: number;
  sno?: number | string;
  sku: string;
  name: string;
  category: string;
  brand?: string;
  barcode?: string;
  spec?: string;
  purchase_price: number;
  selling_price?: number;
  mrp?: number;
  tax_percent?: number;
  min_stock?: number;
  pkg?: number;
  status: ImportPreviewStatus;
  matchedProductId?: number;
  matchedProductName?: string;
  matchedSku?: string;
  matchTier?: "sku" | "barcode" | "name_brand_model";
  oldPurchasePrice?: number;
  newPurchasePrice?: number;
  oldSellingPrice?: number;
  newSellingPrice?: number;
  isDuplicateInFile?: boolean;
  duplicateOfRow?: number;
  validationError?: string;
  ambiguityReason?: string;
}

export interface ImportPreviewSummary {
  total: number;
  newCount: number;
  existingCount: number;
  priceChangeCount: number;
  duplicateCount: number;
  invalidCount: number;
  ambiguousCount: number;
}

export interface ImportPreviewResult {
  format: "erd" | "standard";
  summary: ImportPreviewSummary;
  categories: string[];
  items: ImportPreviewItem[];
}

export interface ImportProductsResult {
  total: number;
  created: number;
  updated: number;
  priceChanges: number;
  categories: number;
  categoryNames?: string[];
}

export function previewImportProductsApi(payload: {
  file?: File;
  csvText?: string;
  shopId?: number;
  defaultBrand?: string;
  defaultMarginPercent?: number;
}) {
  if (payload.file) {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.shopId) formData.append("shopId", String(payload.shopId));
    if (payload.defaultBrand) formData.append("defaultBrand", payload.defaultBrand);
    if (payload.defaultMarginPercent) formData.append("defaultMarginPercent", String(payload.defaultMarginPercent));
    return api.post<ApiEnvelope<ImportPreviewResult>>("/products/import/preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
  return api.post<ApiEnvelope<ImportPreviewResult>>("/products/import/preview", payload);
}

export function importProductsApi(payload: {
  items?: ImportPreviewItem[];
  file?: File;
  csvText?: string;
  shopId?: number;
  updateExisting?: boolean;
  updatePurchasePrice?: boolean;
  updateSellingPrice?: boolean;
  defaultMarginPercent?: number;
  defaultBrand?: string;
}) {
  if (payload.file && !payload.items) {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.shopId) formData.append("shopId", String(payload.shopId));
    if (payload.updateExisting !== undefined) formData.append("updateExisting", String(payload.updateExisting));
    if (payload.updatePurchasePrice !== undefined) formData.append("updatePurchasePrice", String(payload.updatePurchasePrice));
    if (payload.updateSellingPrice !== undefined) formData.append("updateSellingPrice", String(payload.updateSellingPrice));
    if (payload.defaultMarginPercent) formData.append("defaultMarginPercent", String(payload.defaultMarginPercent));
    if (payload.defaultBrand) formData.append("defaultBrand", payload.defaultBrand);
    return api.post<ApiEnvelope<ImportProductsResult>>("/products/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  return api.post<ApiEnvelope<ImportProductsResult>>("/products/import", payload);
}
