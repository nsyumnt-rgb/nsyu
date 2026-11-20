import { Request, Response } from "express";
import { Category, Product, Subcategory, sequelize } from "../models";
import { logAudit } from "../utils/audit";
import { removeImage, saveImage } from "../utils/mediaStorage";

export async function createCategory(req: Request, res: Response) {
  const { name, status, icon, image_url } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: "Category name is required" });

  const trimmedName = String(name).trim();
  const existing = await Category.findOne({ where: { owner_id: req.auth!.ownerId, name: trimmedName } });
  if (existing) return res.status(409).json({ success: false, message: "Category already exists" });

  const category = await Category.create({
    owner_id: req.auth!.ownerId,
    name: trimmedName,
    status: status === "inactive" ? "inactive" : "active",
    icon: icon ? String(icon).trim() : null,
    image_url: image_url ? String(image_url).trim() : null,
  });

  await logAudit({ req, module: "products", action: "create_category", entityType: "Category", entityId: category.id });
  return res.status(201).json({ success: true, data: category });
}

export async function listCategories(req: Request, res: Response) {
  const categories = await Category.findAll({
    where: { owner_id: req.auth!.ownerId },
    include: [{ model: Subcategory, as: "subcategories" }],
    order: [["name", "ASC"]],
  });

  const categoryIds = categories.map((c) => c.id);
  const counts = (await Product.findAll({
    attributes: ["category_id", [sequelize.fn("COUNT", sequelize.col("id")), "product_count"]],
    where: { category_id: categoryIds },
    group: ["category_id"],
    raw: true,
  })) as any[];

  const countMap: Record<number, number> = {};
  for (const r of counts) {
    if (r.category_id) countMap[Number(r.category_id)] = Number(r.product_count);
  }

  const data = categories.map((c) => {
    const json = c.toJSON() as any;
    json.product_count = countMap[c.id] || 0;
    return json;
  });

  return res.json({ success: true, data });
}

export async function updateCategory(req: Request, res: Response) {
  const categoryId = Number(req.params.categoryId);
  const category = await Category.findOne({ where: { id: categoryId, owner_id: req.auth!.ownerId } });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  const { name, icon, image_url, status } = req.body;
  if (name && String(name).trim()) category.name = String(name).trim();
  if (icon !== undefined) category.icon = icon ? String(icon).trim() : null;
  if (image_url !== undefined) category.image_url = image_url ? String(image_url).trim() : null;
  if (status && (status === "active" || status === "inactive")) category.status = status;

  await category.save();

  await logAudit({ req, module: "products", action: "update_category", entityType: "Category", entityId: categoryId });
  return res.json({ success: true, data: category });
}

export async function uploadCategoryImage(req: Request, res: Response) {
  const categoryId = Number(req.params.categoryId);
  const category = await Category.findOne({ where: { id: categoryId, owner_id: req.auth!.ownerId } });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ success: false, message: "Choose an image file to upload" });

  let url: string;
  try {
    url = await saveImage(file, `owners/${req.auth!.ownerId}/categories/${category.id}`);
  } catch (err: any) {
    return res.status(err?.status || 500).json({ success: false, message: err?.message || "Could not store the category image" });
  }

  const oldUrl = category.image_url;
  category.image_url = url;
  await category.save();
  await removeImage(oldUrl);

  await logAudit({ req, module: "products", action: "upload_category_image", entityType: "Category", entityId: category.id });
  return res.json({ success: true, data: { imageUrl: url, category } });
}

export async function deleteCategory(req: Request, res: Response) {
  const categoryId = Number(req.params.categoryId);
  const category = await Category.findOne({ where: { id: categoryId, owner_id: req.auth!.ownerId } });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  await Product.update({ category_id: null }, { where: { category_id: categoryId } });
  await Subcategory.destroy({ where: { category_id: categoryId } });
  const oldUrl = category.image_url;
  await category.destroy();
  await removeImage(oldUrl);

  await logAudit({ req, module: "products", action: "delete_category", entityType: "Category", entityId: categoryId });
  return res.json({ success: true, message: "Category deleted successfully", data: { id: categoryId } });
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
