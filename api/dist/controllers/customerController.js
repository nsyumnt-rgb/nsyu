"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomer = createCustomer;
exports.listCustomers = listCustomers;
exports.getCustomer = getCustomer;
exports.updateCustomer = updateCustomer;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const audit_1 = require("../utils/audit");
async function createCustomer(req, res) {
    const { name, phone, email, address, gstin, openingBalance, notes } = req.body;
    if (!name)
        return res.status(400).json({ success: false, message: "name is required" });
    const customer = await models_1.Customer.create({
        owner_id: req.auth.ownerId,
        name,
        phone: phone ?? null,
        email: email ?? null,
        address: address ?? null,
        gstin: gstin ?? null,
        opening_balance: Number(openingBalance) || 0,
        current_balance: Number(openingBalance) || 0,
        notes: notes ?? null,
    });
    await (0, audit_1.logAudit)({ req, module: "customers", action: "create", entityType: "Customer", entityId: customer.id });
    return res.status(201).json({ success: true, data: customer });
}
async function listCustomers(req, res) {
    const { search, status } = req.query;
    const where = { owner_id: req.auth.ownerId };
    if (status)
        where.status = status;
    if (search) {
        where[sequelize_1.Op.or] = [
            { name: { [sequelize_1.Op.like]: `%${search}%` } },
            { phone: { [sequelize_1.Op.like]: `%${search}%` } },
            { email: { [sequelize_1.Op.like]: `%${search}%` } },
        ];
    }
    const customers = await models_1.Customer.findAll({ where, order: [["name", "ASC"]] });
    return res.json({ success: true, data: customers });
}
async function getCustomer(req, res) {
    const param = String(req.params.customerId).trim();
    const isNumeric = /^\d+$/.test(param);
    const where = { owner_id: req.auth.ownerId };
    if (isNumeric) {
        where[sequelize_1.Op.or] = [
            { id: Number(param) },
            { phone: param },
        ];
    }
    else {
        where[sequelize_1.Op.or] = [
            { phone: param },
            { name: { [sequelize_1.Op.like]: `%${param}%` } },
        ];
    }
    const customer = await models_1.Customer.findOne({
        where,
        include: [
            {
                model: models_1.Sale,
                as: "sales",
                limit: 10,
                order: [["created_at", "DESC"]],
            },
            {
                model: models_1.CustomerLedger,
                as: "ledgerEntries",
                limit: 20,
                order: [["created_at", "DESC"]],
            },
            {
                model: models_1.EMIPlan,
                as: "emiPlans",
            },
        ],
    });
    if (!customer)
        return res.status(404).json({ success: false, message: "Customer not found" });
    return res.json({ success: true, data: customer });
}
async function updateCustomer(req, res) {
    const customer = await models_1.Customer.findOne({ where: { id: req.params.customerId, owner_id: req.auth.ownerId } });
    if (!customer)
        return res.status(404).json({ success: false, message: "Customer not found" });
    const { name, phone, email, address, gstin, status, notes } = req.body;
    if (name !== undefined)
        customer.name = name;
    if (phone !== undefined)
        customer.phone = phone;
    if (email !== undefined)
        customer.email = email;
    if (address !== undefined)
        customer.address = address;
    if (gstin !== undefined)
        customer.gstin = gstin;
    if (status !== undefined)
        customer.status = status;
    if (notes !== undefined)
        customer.notes = notes;
    await customer.save();
    await (0, audit_1.logAudit)({ req, module: "customers", action: "update", entityType: "Customer", entityId: customer.id });
    return res.json({ success: true, data: customer });
}
//# sourceMappingURL=customerController.js.map