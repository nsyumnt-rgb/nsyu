import { Request, Response } from "express";
import { Category, Subcategory } from "../models";
import { logAudit } from "../utils/audit";

export async function createCategory(req: Request, res: Response) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name is required" });

  const existing = await Category.findOne({ where: { owner_id: req.auth!.ownerId, name } });
  if (existing) return res.status(409).json({ success: false, message: "Category already exists" });

  const category = await Category.create({ owner_id: req.auth!.ownerId, name });
  await logAudit({ req, module: "products", action: "create_category", entityType: "Category", entityId: category.id });
  return res.status(201).json({ success: true, data: category });
}

export async function listCategories(req: Request, res: Response) {
  const categories = await Category.findAll({
    where: { owner_id: req.auth!.ownerId },
    include: [{ model: Subcategory, as: "subcategories" }],
    order: [["name", "ASC"]],
  });
  return res.json({ success: true, data: categories });
}

export async function updateCategory(req: Request, res: Response) {
  const categoryId = Number(req.params.categoryId);
  const category = await Category.findOne({ where: { id: categoryId, owner_id: req.auth!.ownerId } });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  const { name } = req.body;
  if (name) category.name = name;
  await category.save();

  await logAudit({ req, module: "products", action: "update_category", entityType: "Category", entityId: categoryId });
  return res.json({ success: true, data: category });
}

export async function setCategoryStatus(req: Request, res: Response) {
  const categoryId = Number(req.params.categoryId);
  const { status } = req.body; // "active" | "inactive"

  const category = await Category.findOne({ where: { id: categoryId, owner_id: req.auth!.ownerId } });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  category.status = status;
  await category.save();

  await logAudit({ req, module: "products", action: "set_category_status", entityType: "Category", entityId: categoryId, details: { status } });
  return res.json({ success: true, data: category });
}

/* ---------------- Subcategory ---------------- */

export async function createSubcategory(req: Request, res: Response) {
  const { categoryId, name } = req.body;
  if (!categoryId || !name) return res.status(400).json({ success: false, message: "categoryId and name are required" });

  const category = await Category.findOne({ where: { id: categoryId, owner_id: req.auth!.ownerId } });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  const subcategory = await Subcategory.create({ owner_id: req.auth!.ownerId, category_id: categoryId, name });
  await logAudit({ req, module: "products", action: "create_subcategory", entityType: "Subcategory", entityId: subcategory.id });
  return res.status(201).json({ success: true, data: subcategory });
}

export async function setSubcategoryStatus(req: Request, res: Response) {
  const subcategoryId = Number(req.params.subcategoryId);
  const { status } = req.body;

  const subcategory = await Subcategory.findOne({ where: { id: subcategoryId, owner_id: req.auth!.ownerId } });
  if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found" });

  subcategory.status = status;
  await subcategory.save();

  await logAudit({ req, module: "products", action: "set_subcategory_status", entityType: "Subcategory", entityId: subcategoryId, details: { status } });
  return res.json({ success: true, data: subcategory });
}
