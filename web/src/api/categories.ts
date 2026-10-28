import { api } from "./client";
import type { ApiEnvelope, Category, Subcategory } from "../types";

export function listCategories() {
  return api.get<ApiEnvelope<Category[]>>("/categories");
}

export function createCategory(name: string) {
  return api.post<ApiEnvelope<Category>>("/categories", { name });
}

export function updateCategory(categoryId: number, name: string) {
  return api.put<ApiEnvelope<Category>>(`/categories/${categoryId}`, { name });
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
