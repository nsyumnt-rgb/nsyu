import { api } from "./client";
import type { ApiEnvelope, Category, Subcategory } from "../types";

export function listCategories() {
  return api.get<ApiEnvelope<Category[]>>("/categories");
}

export interface CategoryPayload {
  name: string;
  status?: "active" | "inactive";
  icon?: string | null;
  image_url?: string | null;
  alias?: string | null;
}

export function createCategory(payload: string | CategoryPayload, status?: "active" | "inactive") {
  if (typeof payload === "string") {
    return api.post<ApiEnvelope<Category>>("/categories", { name: payload, status: status || "active" });
  }
  return api.post<ApiEnvelope<Category>>("/categories", payload);
}

export function updateCategory(categoryId: number, payload: string | Partial<CategoryPayload>) {
  if (typeof payload === "string") {
    return api.put<ApiEnvelope<Category>>(`/categories/${categoryId}`, { name: payload });
  }
  return api.put<ApiEnvelope<Category>>(`/categories/${categoryId}`, payload);
}

export function uploadCategoryImage(categoryId: number, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return api.post<ApiEnvelope<{ imageUrl: string; category: Category }>>(`/categories/${categoryId}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteCategory(categoryId: number) {
  return api.delete<ApiEnvelope<{ id: number }>>(`/categories/${categoryId}`);
}

export function setCategoryStatus(categoryId: number, status: "active" | "inactive") {
  return api.patch<ApiEnvelope<Category>>(`/categories/${categoryId}/status`, { status });
}

export function createSubcategory(categoryId: number, name: string) {
  return api.post<ApiEnvelope<Subcategory>>("/categories/subcategories", { categoryId, name });
}

export function setSubcategoryStatus(subcategoryId: number, status: "active" | "inactive") {
  return api.patch<ApiEnvelope<Subcategory>>(`/categories/subcategories/${subcategoryId}/status`, { status });
}
