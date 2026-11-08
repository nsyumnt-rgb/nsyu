"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestOtp = requestOtp;
exports.verifyOtp = verifyOtp;
exports.refreshCustomerToken = refreshCustomerToken;
exports.logoutCustomer = logoutCustomer;
exports.selfRegisterCustomer = selfRegisterCustomer;
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const jwt_1 = require("../utils/jwt");
const audit_1 = require("../utils/audit");
function hashString(val) {
    return crypto_1.default.createHash("sha256").update(val).digest("hex");
}
function normalizePhone(raw) {
    return raw.replace(/[^0-9]/g, "").slice(-10);
}
/**
 * POST /api/customer-portal/auth/request-otp
 * Rate-limited (max 3 per 15 min per phone).
 * Always returns identical response regardless of phone existence (anti-enumeration).
 */
async function requestOtp(req, res) {
    try {
        const { phone: rawPhone, shopCode, shopId: inputShopId } = req.body;
        if (!rawPhone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }
        const phone = normalizePhone(String(rawPhone));
        if (phone.length < 10) {
            return res.status(400).json({ success: false, message: "Invalid phone number" });
        }
        // Resolve shop
        let shop = null;
        if (shopCode) {
            shop = await models_1.Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
        }
        else if (inputShopId) {
            shop = await models_1.Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
        }
        else {
            shop = await models_1.Shop.findOne({ where: { status: "active" }, order: [["id", "ASC"]] });
        }
        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        // Rate limiting: Max 3 OTP requests per phone per 15 minutes (in production)
        if (process.env.NODE_ENV !== "test") {
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
            const recentCount = await models_1.CustomerOtp.count({
                where: {
                    phone,
                    shop_id: shop.id,
                    created_at: { [sequelize_1.Op.gte]: fifteenMinsAgo },
                },
            });
            if (recentCount >= 3) {
                return res.status(429).json({
                    success: false,
                    message: "Too many OTP requests. Please wait 15 minutes before trying again.",
                });
            }
        }
        // Check account for this phone and shop
        const account = await models_1.CustomerAccount.findOne({
            where: {
                phone,
                shop_id: shop.id,
                status: "active",
            },
            include: [{ model: models_1.Customer, as: "customer" }],
        });
        let generatedOtp = null;
        if (account) {
            // Generate 6-digit OTP
            generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpHash = hashString(generatedOtp);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            await models_1.CustomerOtp.create({
                account_id: account.id,
                phone,
                shop_id: shop.id,
                otp_hash: otpHash,
                expires_at: expiresAt,
                attempts: 0,
            });
            // Audit log
            await (0, audit_1.logAudit)({
                req,
                module: "customer_portal",
                action: "otp_requested",
                entityType: "CustomerAccount",
                entityId: account.id,
                details: { phone, shopId: shop.id },
            });
        }
        const responseData = {
            success: true,
            message: "If this phone number is registered with this shop, a 6-digit OTP has been sent.",
        };
        // In test environment, expose the OTP to facilitate testing
        if (process.env.NODE_ENV === "test" && generatedOtp) {
            responseData.debugOtp = generatedOtp;
        }
        return res.json(responseData);
    }
    catch (err) {
        console.error("requestOtp error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to process OTP request" });
    }
}
/**
 * POST /api/customer-portal/auth/verify-otp
 * Verifies the 6-digit OTP within 5 minutes and under 5 wrong attempts.
 */
async function verifyOtp(req, res) {
    try {
        const { phone: rawPhone, shopCode, shopId: inputShopId, otp, deviceInfo } = req.body;
        if (!rawPhone || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and OTP are required" });
        }
        const phone = normalizePhone(String(rawPhone));
        // Resolve shop
        let shop = null;
        if (shopCode) {
            shop = await models_1.Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
        }
        else if (inputShopId) {
            shop = await models_1.Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
        }
        else {
            shop = await models_1.Shop.findOne({ where: { status: "active" }, order: [["id", "ASC"]] });
        }
        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        const account = await models_1.CustomerAccount.findOne({
            where: { phone, shop_id: shop.id },
            include: [{ model: models_1.Customer, as: "customer" }],
        });
        if (!account) {
            return res.status(401).json({ success: false, message: "Invalid credentials or account not found" });
        }
        if (account.status !== "active") {
            return res.status(403).json({
                success: false,
                message: account.status === "pending_approval"
                    ? "Your account registration is pending shop approval"
                    : "Your account has been disabled by the shop",
            });
        }
        // Find the latest non-used OTP
        const latestOtp = await models_1.CustomerOtp.findOne({
            where: {
                account_id: account.id,
                phone,
                shop_id: shop.id,
                used_at: null,
            },
            order: [["created_at", "DESC"]],
        });
        if (!latestOtp) {
            return res.status(400).json({ success: false, message: "No active OTP found. Please request a new one." });
        }
        // Check attempts limit (max 5)
        if (latestOtp.attempts >= 5) {
            return res.status(400).json({
                success: false,
                message: "Too many failed attempts. This OTP has been invalidated. Please request a new one.",
            });
        }
        // Check expiry (5 minutes)
        if (new Date() > latestOtp.expires_at) {
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }
        // Verify OTP hash
        const inputHash = hashString(String(otp).trim());
        if (inputHash !== latestOtp.otp_hash) {
            latestOtp.attempts += 1;
            await latestOtp.save();
            const remaining = 5 - latestOtp.attempts;
            return res.status(400).json({
                success: false,
                message: remaining > 0 ? `Incorrect OTP. ${remaining} attempts remaining.` : "OTP invalidated after 5 failed attempts.",
            });
        }
        // Mark OTP as used
        latestOtp.used_at = new Date();
        await latestOtp.save();
        // Issue customer tokens
        const accessToken = (0, jwt_1.signAccessToken)({
            ownerId: account.owner_id,
            shopId: account.shop_id,
            customerId: account.customer_id,
            accountId: account.id,
            phone: account.phone,
            isOwner: false,
            isCustomer: true,
            roleCode: "user",
            roleName: "User",
        });
        const rawRefreshToken = crypto_1.default.randomBytes(40).toString("hex");
        const refreshHash = hashString(rawRefreshToken);
        const refreshExpiry = (0, jwt_1.refreshExpiryDate)();
        await models_1.CustomerRefreshToken.create({
            account_id: account.id,
            token_hash: refreshHash,
            device_info: deviceInfo ? String(deviceInfo).slice(0, 255) : null,
            expires_at: refreshExpiry,
        });
        account.last_login_at = new Date();
        await account.save();
        await (0, audit_1.logAudit)({
            req,
            module: "customer_portal",
            action: "login_success",
            entityType: "CustomerAccount",
            entityId: account.id,
            details: { phone, shopId: shop.id },
        });
        const customerRecord = account.customer;
        return res.json({
            success: true,
            message: "Login successful",
            data: {
                accessToken,
                refreshToken: rawRefreshToken,
                customer: {
                    id: customerRecord.id,
                    name: customerRecord.name,
                    phone: customerRecord.phone,
                    email: customerRecord.email,
                    address: customerRecord.address,
                    currentBalance: Number(customerRecord.current_balance || 0),
                    shop: {
                        id: shop.id,
                        name: shop.name,
                        code: shop.code,
                        address: shop.address,
                        phone: shop.phone,
                    },
                },
            },
        });
    }
    catch (err) {
        console.error("verifyOtp error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to verify OTP" });
    }
}
/**
 * POST /api/customer-portal/auth/refresh
 * Rotates the refresh token and re-issues an access token.
 * Reuse detection: if a revoked token is presented, invalidates the entire token chain.
 */
async function refreshCustomerToken(req, res) {
    try {
        const { refreshToken: rawToken } = req.body;
        if (!rawToken) {
            return res.status(400).json({ success: false, message: "refreshToken is required" });
        }
        const tokenHash = hashString(String(rawToken));
        const tokenRecord = await models_1.CustomerRefreshToken.findOne({
            where: { token_hash: tokenHash },
        });
        if (!tokenRecord) {
            return res.status(401).json({ success: false, message: "Invalid refresh token" });
        }
        // Reuse detection (CP-A05):
        if (tokenRecord.revoked_at) {
            // Token was already revoked! Possible token theft -> Revoke ALL tokens for this account!
            await models_1.CustomerRefreshToken.update({ revoked_at: new Date() }, { where: { account_id: tokenRecord.account_id, revoked_at: null } });
            return res.status(401).json({
                success: false,
                message: "Refresh token reuse detected. All sessions revoked. Please log in again.",
            });
        }
        if (new Date() > tokenRecord.expires_at) {
            return res.status(401).json({ success: false, message: "Refresh token expired" });
        }
        // Revoke the current token
        tokenRecord.revoked_at = new Date();
        await tokenRecord.save();
        // Verify account is still active
        const account = await models_1.CustomerAccount.findByPk(tokenRecord.account_id);
        if (!account || account.status !== "active") {
            return res.status(401).json({ success: false, message: "Account is disabled or inactive" });
        }
        // Issue new pair
        const newAccessToken = (0, jwt_1.signAccessToken)({
            ownerId: account.owner_id,
            shopId: account.shop_id,
            customerId: account.customer_id,
            accountId: account.id,
            phone: account.phone,
            isOwner: false,
            isCustomer: true,
            roleCode: "user",
            roleName: "User",
        });
        const newRawRefreshToken = crypto_1.default.randomBytes(40).toString("hex");
        const newRefreshHash = hashString(newRawRefreshToken);
        await models_1.CustomerRefreshToken.create({
            account_id: account.id,
            token_hash: newRefreshHash,
            expires_at: (0, jwt_1.refreshExpiryDate)(),
        });
        return res.json({
            success: true,
            data: {
                accessToken: newAccessToken,
                refreshToken: newRawRefreshToken,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Token refresh failed" });
    }
}
/**
 * POST /api/customer-portal/auth/logout
 * Revokes refresh token immediately.
 */
async function logoutCustomer(req, res) {
    try {
        const { refreshToken: rawToken } = req.body;
        if (rawToken) {
            const tokenHash = hashString(String(rawToken));
            await models_1.CustomerRefreshToken.update({ revoked_at: new Date() }, { where: { token_hash: tokenHash } });
        }
        return res.json({ success: true, message: "Logged out successfully" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Logout failed" });
    }
}
/**
 * POST /api/customer-portal/auth/register
 * Self-registration (active only if S2 allow_self_registration is ON for the shop).
 */
async function selfRegisterCustomer(req, res) {
    try {
        const { name, phone: rawPhone, shopCode, shopId: inputShopId, email, address } = req.body;
        if (!name || !rawPhone) {
            return res.status(400).json({ success: false, message: "Name and phone number are required" });
        }
        const phone = normalizePhone(String(rawPhone));
        // Resolve shop
        let shop = null;
        if (shopCode) {
            shop = await models_1.Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
        }
        else if (inputShopId) {
            shop = await models_1.Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
        }
        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        // Check S2 setting
        const portalSettings = await models_1.ShopPortalSettings.findOne({ where: { shop_id: shop.id } });
        if (!portalSettings || !portalSettings.allow_self_registration) {
            return res.status(403).json({
                success: false,
                message: "Self-registration is not enabled for this shop. Please ask the shop for an invite.",
            });
        }
        // Find or create customer
        let customer = await models_1.Customer.findOne({
            where: { phone, owner_id: shop.owner_id },
        });
        if (!customer) {
            customer = await models_1.Customer.create({
                owner_id: shop.owner_id,
                name: String(name).trim(),
                phone,
                email: email ? String(email).trim() : null,
                address: address ? String(address).trim() : null,
                opening_balance: 0,
                current_balance: 0,
                status: "active",
            });
        }
        // Check if account already exists
        const existingAccount = await models_1.CustomerAccount.findOne({
            where: { customer_id: customer.id, shop_id: shop.id },
        });
        if (existingAccount) {
            if (existingAccount.status === "active") {
                return res.status(400).json({
                    success: false,
                    message: "An active portal account already exists for this phone. Please log in directly.",
                });
            }
            return res.status(400).json({
                success: false,
                message: "A registration request is already submitted and awaiting approval.",
            });
        }
        const newAccount = await models_1.CustomerAccount.create({
            customer_id: customer.id,
            shop_id: shop.id,
            owner_id: shop.owner_id,
            phone,
            status: "pending_approval",
        });
        // Notify shop owner
        try {
            await models_1.Notification.create({
                owner_id: shop.owner_id,
                shop_id: shop.id,
                recipient_type: "owner",
                recipient_id: shop.owner_id,
                type: "approval_needed",
                title: "Portal Self-Registration Request",
                message: `Customer ${customer.name} (${phone}) requested portal access for ${shop.name}.`,
                reference_type: "customer_account",
                reference_id: newAccount.id,
            });
        }
        catch { }
        return res.status(201).json({
            success: true,
            message: "Registration submitted successfully. The shop will review and approve your account shortly.",
            data: {
                accountId: newAccount.id,
                status: newAccount.status,
            },
        });
    }
    catch (err) {
        console.error("selfRegisterCustomer error:", err);
        return res.status(500).json({ success: false, message: err.message || "Registration failed" });
    }
}
//# sourceMappingURL=customerAuthController.js.map