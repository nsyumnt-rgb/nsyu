"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = createCategory;
exports.listCategories = listCategories;
exports.updateCategory = updateCategory;
exports.setCategoryStatus = setCategoryStatus;
exports.createSubcategory = createSubcategory;
exports.setSubcategoryStatus = setSubcategoryStatus;
const models_1 = require("../models");
const audit_1 = require("../utils/audit");
async function createCategory(req, res) {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ success: false, message: "name is required" });
    const existing = await models_1.Category.findOne({ where: { owner_id: req.auth.ownerId, name } });
    if (existing)
        return res.status(409).json({ success: false, message: "Category already exists" });
    const category = await models_1.Category.create({ owner_id: req.auth.ownerId, name });
    await (0, audit_1.logAudit)({ req, module: "products", action: "create_category", entityType: "Category", entityId: category.id });
    return res.status(201).json({ success: true, data: category });
}
async function listCategories(req, res) {
    const categories = await models_1.Category.findAll({
        where: { owner_id: req.auth.ownerId },
        include: [{ model: models_1.Subcategory, as: "subcategories" }],
        order: [["name", "ASC"]],
    });
    return res.json({ success: true, data: categories });
}
async function updateCategory(req, res) {
    const categoryId = Number(req.params.categoryId);
    const category = await models_1.Category.findOne({ where: { id: categoryId, owner_id: req.auth.ownerId } });
    if (!category)
        return res.status(404).json({ success: false, message: "Category not found" });
    const { name } = req.body;
    if (name)
        category.name = name;
    await category.save();
    await (0, audit_1.logAudit)({ req, module: "products", action: "update_category", entityType: "Category", entityId: categoryId });
    return res.json({ success: true, data: category });
}
async function setCategoryStatus(req, res) {
    const categoryId = Number(req.params.categoryId);
    const { status } = req.body; // "active" | "inactive"
    const category = await models_1.Category.findOne({ where: { id: categoryId, owner_id: req.auth.ownerId } });
    if (!category)
        return res.status(404).json({ success: false, message: "Category not found" });
    category.status = status;
    await category.save();
    await (0, audit_1.logAudit)({ req, module: "products", action: "set_category_status", entityType: "Category", entityId: categoryId, details: { status } });
    return res.json({ success: true, data: category });
}
/* ---------------- Subcategory ---------------- */
async function createSubcategory(req, res) {
    const { categoryId, name } = req.body;
    if (!categoryId || !name)
        return res.status(400).json({ success: false, message: "categoryId and name are required" });
    const category = await models_1.Category.findOne({ where: { id: categoryId, owner_id: req.auth.ownerId } });
    if (!category)
        return res.status(404).json({ success: false, message: "Category not found" });
    const subcategory = await models_1.Subcategory.create({ owner_id: req.auth.ownerId, category_id: categoryId, name });
    await (0, audit_1.logAudit)({ req, module: "products", action: "create_subcategory", entityType: "Subcategory", entityId: subcategory.id });
    return res.status(201).json({ success: true, data: subcategory });
}
async function setSubcategoryStatus(req, res) {
    const subcategoryId = Number(req.params.subcategoryId);
    const { status } = req.body;
    const subcategory = await models_1.Subcategory.findOne({ where: { id: subcategoryId, owner_id: req.auth.ownerId } });
    if (!subcategory)
        return res.status(404).json({ success: false, message: "Subcategory not found" });
    subcategory.status = status;
    await subcategory.save();
    await (0, audit_1.logAudit)({ req, module: "products", action: "set_subcategory_status", entityType: "Subcategory", entityId: subcategoryId, details: { status } });
    return res.json({ success: true, data: subcategory });
}
//# sourceMappingURL=categoryController.js.map