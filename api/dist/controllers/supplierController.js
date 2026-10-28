"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupplier = createSupplier;
exports.listSuppliers = listSuppliers;
exports.getSupplier = getSupplier;
exports.updateSupplier = updateSupplier;
exports.setSupplierStatus = setSupplierStatus;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const audit_1 = require("../utils/audit");
async function createSupplier(req, res) {
    const { name, phone, email, address, gstin } = req.body;
    if (!name)
        return res.status(400).json({ success: false, message: "name is required" });
    const supplier = await models_1.Supplier.create({ owner_id: req.auth.ownerId, name, phone, email, address, gstin: gstin ?? null });
    await (0, audit_1.logAudit)({ req, module: "suppliers", action: "create", entityType: "Supplier", entityId: supplier.id });
    return res.status(201).json({ success: true, data: supplier });
}
async function listSuppliers(req, res) {
    const { search, status } = req.query;
    const where = { owner_id: req.auth.ownerId };
    where.status = status || "active";
    if (search) {
        where[sequelize_1.Op.or] = [
            { name: { [sequelize_1.Op.like]: `%${search}%` } },
            { phone: { [sequelize_1.Op.like]: `%${search}%` } },
            { email: { [sequelize_1.Op.like]: `%${search}%` } },
        ];
    }
    const suppliers = await models_1.Supplier.findAll({ where, order: [["name", "ASC"]] });
    return res.json({ success: true, data: suppliers });
}
async function getSupplier(req, res) {
    const param = String(req.params.supplierId).trim();
    const isNumeric = /^\d+$/.test(param);
    const where = { owner_id: req.auth.ownerId };
    if (isNumeric) {
        where.id = Number(param);
    }
    else {
        where.name = { [sequelize_1.Op.iLike]: param };
    }
    const supplier = await models_1.Supplier.findOne({
        where,
        include: [
            {
                model: models_1.Purchase,
                as: "purchases",
                limit: 15,
                order: [["created_at", "DESC"]],
            },
            {
                model: models_1.SupplierLedger,
                as: "ledgerEntries",
                limit: 25,
                order: [["created_at", "DESC"]],
            },
        ],
    });
    if (!supplier)
        return res.status(404).json({ success: false, message: "Supplier not found" });
    return res.json({ success: true, data: supplier });
}
async function updateSupplier(req, res) {
    const supplier = await models_1.Supplier.findOne({ where: { id: req.params.supplierId, owner_id: req.auth.ownerId } });
    if (!supplier)
        return res.status(404).json({ success: false, message: "Supplier not found" });
    const { name, phone, email, address, gstin } = req.body;
    if (name !== undefined)
        supplier.name = name;
    if (phone !== undefined)
        supplier.phone = phone;
    if (email !== undefined)
        supplier.email = email;
    if (address !== undefined)
        supplier.address = address;
    if (gstin !== undefined)
        supplier.gstin = gstin;
    await supplier.save();
    await (0, audit_1.logAudit)({ req, module: "suppliers", action: "update", entityType: "Supplier", entityId: supplier.id });
    return res.json({ success: true, data: supplier });
}
/** Activate/deactivate — never a hard delete, since a supplier may be referenced by historical Products/Purchases. */
async function setSupplierStatus(req, res) {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ success: false, message: "status must be 'active' or 'inactive'" });
    }
    const supplier = await models_1.Supplier.findOne({ where: { id: req.params.supplierId, owner_id: req.auth.ownerId } });
    if (!supplier)
        return res.status(404).json({ success: false, message: "Supplier not found" });
    supplier.status = status;
    await supplier.save();
    await (0, audit_1.logAudit)({ req, module: "suppliers", action: "set_status", entityType: "Supplier", entityId: supplier.id, details: { status } });
    return res.json({ success: true, data: supplier });
}
//# sourceMappingURL=supplierController.js.map