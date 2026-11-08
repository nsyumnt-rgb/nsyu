"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomer = createCustomer;
exports.listCustomers = listCustomers;
exports.getCustomer = getCustomer;
exports.updateCustomer = updateCustomer;
exports.inviteCustomerToPortal = inviteCustomerToPortal;
exports.disableCustomerPortal = disableCustomerPortal;
exports.enableCustomerPortal = enableCustomerPortal;
exports.listPortalRequests = listPortalRequests;
exports.approvePortalRequest = approvePortalRequest;
exports.rejectPortalRequest = rejectPortalRequest;
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
/**
 * POST /api/customers/:customerId/portal/invite
 * Enables customer portal login and generates an invite.
 */
async function inviteCustomerToPortal(req, res) {
    try {
        const customerId = Number(req.params.customerId);
        const ownerId = req.auth.ownerId;
        let shopId = req.auth.shopId;
        if (!shopId && req.body.shopId) {
            shopId = Number(req.body.shopId);
        }
        if (!shopId) {
            const shop = await models_1.Shop.findOne({ where: { owner_id: ownerId, status: "active" }, order: [["id", "ASC"]] });
            shopId = shop ? shop.id : 1;
        }
        const customer = await models_1.Customer.findOne({ where: { id: customerId, owner_id: ownerId } });
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        if (!customer.phone) {
            return res.status(400).json({ success: false, message: "Customer must have a valid phone number to enable portal access" });
        }
        const cleanPhone = customer.phone.replace(/[^0-9]/g, "").slice(-10);
        let [account, created] = await models_1.CustomerAccount.findOrCreate({
            where: { customer_id: customer.id },
            defaults: {
                customer_id: customer.id,
                shop_id: shopId,
                owner_id: ownerId,
                phone: cleanPhone,
                status: "active",
                created_by: req.auth.employeeId || req.auth.ownerId,
            },
        });
        if (!created && account.status !== "active") {
            account.status = "active";
            account.shop_id = shopId;
            account.phone = cleanPhone;
            await account.save();
        }
        const shop = await models_1.Shop.findByPk(shopId);
        const inviteLink = `/portal/login?phone=${cleanPhone}&shop=${shop?.code || shopId}`;
        await (0, audit_1.logAudit)({
            req,
            module: "customers",
            action: "portal_invite_sent",
            entityType: "CustomerAccount",
            entityId: account.id,
            details: { customerId: customer.id, phone: cleanPhone, shopId },
        });
        return res.json({
            success: true,
            message: "Customer portal login enabled successfully",
            data: {
                accountId: account.id,
                customerId: customer.id,
                phone: cleanPhone,
                status: account.status,
                inviteLink,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to invite customer to portal" });
    }
}
/**
 * POST /api/customers/:customerId/portal/disable
 */
async function disableCustomerPortal(req, res) {
    try {
        const customerId = Number(req.params.customerId);
        const ownerId = req.auth.ownerId;
        const account = await models_1.CustomerAccount.findOne({ where: { customer_id: customerId, owner_id: ownerId } });
        if (!account) {
            return res.status(404).json({ success: false, message: "Customer portal account not found" });
        }
        account.status = "disabled";
        await account.save();
        // Revoke all refresh tokens immediately
        await models_1.CustomerRefreshToken.update({ revoked_at: new Date() }, { where: { account_id: account.id, revoked_at: null } });
        await (0, audit_1.logAudit)({
            req,
            module: "customers",
            action: "portal_disabled",
            entityType: "CustomerAccount",
            entityId: account.id,
        });
        return res.json({ success: true, message: "Customer portal access disabled" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to disable portal" });
    }
}
/**
 * POST /api/customers/:customerId/portal/enable
 */
async function enableCustomerPortal(req, res) {
    try {
        const customerId = Number(req.params.customerId);
        const ownerId = req.auth.ownerId;
        const account = await models_1.CustomerAccount.findOne({ where: { customer_id: customerId, owner_id: ownerId } });
        if (!account) {
            return res.status(404).json({ success: false, message: "Customer portal account not found" });
        }
        account.status = "active";
        await account.save();
        await (0, audit_1.logAudit)({
            req,
            module: "customers",
            action: "portal_enabled",
            entityType: "CustomerAccount",
            entityId: account.id,
        });
        return res.json({ success: true, message: "Customer portal access enabled" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to enable portal" });
    }
}
/**
 * GET /api/customers/portal-requests
 */
async function listPortalRequests(req, res) {
    try {
        const ownerId = req.auth.ownerId;
        const shopId = req.auth.shopId;
        const where = { owner_id: ownerId, status: "pending_approval" };
        if (shopId)
            where.shop_id = shopId;
        const requests = await models_1.CustomerAccount.findAll({
            where,
            include: [
                { model: models_1.Customer, as: "customer" },
                { model: models_1.Shop, as: "shop", attributes: ["id", "name", "code"] },
            ],
            order: [["created_at", "DESC"]],
        });
        return res.json({ success: true, data: requests });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list requests" });
    }
}
/**
 * POST /api/customers/portal-requests/:id/approve
 */
async function approvePortalRequest(req, res) {
    try {
        const id = Number(req.params.id);
        const ownerId = req.auth.ownerId;
        const account = await models_1.CustomerAccount.findOne({ where: { id, owner_id: ownerId } });
        if (!account) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        account.status = "active";
        account.approved_by = req.auth.employeeId || req.auth.ownerId;
        await account.save();
        return res.json({ success: true, message: "Portal registration approved", data: account });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Approval failed" });
    }
}
/**
 * POST /api/customers/portal-requests/:id/reject
 */
async function rejectPortalRequest(req, res) {
    try {
        const id = Number(req.params.id);
        const ownerId = req.auth.ownerId;
        const account = await models_1.CustomerAccount.findOne({ where: { id, owner_id: ownerId } });
        if (!account) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        account.status = "disabled";
        await account.save();
        return res.json({ success: true, message: "Portal registration rejected" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Rejection failed" });
    }
}
//# sourceMappingURL=customerController.js.map