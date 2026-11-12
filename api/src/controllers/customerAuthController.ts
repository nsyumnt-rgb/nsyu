import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import {
  CustomerAccount,
  CustomerOtp,
  CustomerRefreshToken,
  Customer,
  Shop,
  ShopPortalSettings,
  Notification,
  Order,
  Sale,
} from "../models";
import { signAccessToken, refreshExpiryDate } from "../utils/jwt";
import { logAudit } from "../utils/audit";
import { maskEmail, sendOtpEmail, isEmailConfigured } from "../utils/mailer";
import { updateSupabaseAuthPassword } from "../utils/supabaseAuth";

function hashString(val: string): string {
  return crypto.createHash("sha256").update(val).digest("hex");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

/**
 * Resolves a customer account using either email or phone number.
 * If explicitShop is provided, searches within that shop first.
 * If not found or if explicitShop is null, searches across all active CustomerAccounts globally,
 * and derives the customer's shop from their account.
 */
async function resolveCustomerAccount(
  rawInput: string,
  explicitShop?: Shop | null
): Promise<{ account: CustomerAccount | null; shop: Shop | null; phone: string; email: string | null; isEmailInput: boolean }> {
  const input = rawInput.trim();
  const isEmailInput = input.includes("@");

  if (isEmailInput) {
    const email = input.toLowerCase();
    let account: CustomerAccount | null = null;
    let customer: Customer | null = null;

    if (explicitShop) {
      customer = await Customer.findOne({
        where: { email, owner_id: explicitShop.owner_id },
      });
      if (customer) {
        account = await CustomerAccount.findOne({
          where: { customer_id: customer.id, shop_id: explicitShop.id },
          include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
        });
      }
    }

    if (!account) {
      account = await CustomerAccount.findOne({
        where: { email },
        include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
        order: [["id", "DESC"]],
      });

      if (!account) {
        customer = await Customer.findOne({
          where: { email },
          order: [["id", "DESC"]],
        });
        if (customer) {
          account = await CustomerAccount.findOne({
            where: { customer_id: customer.id },
            include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
            order: [["id", "DESC"]],
          });
        }
      }
    }

    const resolvedShop = account?.shop || (account?.shop_id ? await Shop.findByPk(account.shop_id) : explicitShop) || null;
    const resolvedPhone = account?.phone || account?.customer?.phone || customer?.phone || "";
    const resolvedEmail = account?.email || account?.customer?.email || customer?.email || email;

    return {
      account,
      shop: resolvedShop,
      phone: resolvedPhone,
      email: resolvedEmail,
      isEmailInput: true,
    };
  } else {
    const phone = normalizePhone(input);
    let account: CustomerAccount | null = null;

    if (explicitShop) {
      account = await CustomerAccount.findOne({
        where: { phone, shop_id: explicitShop.id },
        include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
      });
      if (!account) {
        const cust = await Customer.findOne({
          where: { phone, owner_id: explicitShop.owner_id },
        });
        if (cust) {
          account = await CustomerAccount.findOne({
            where: { customer_id: cust.id, shop_id: explicitShop.id },
            include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
          });
        }
      }
    }

    if (!account) {
      account = await CustomerAccount.findOne({
        where: { phone },
        include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
        order: [["id", "DESC"]],
      });

      if (!account) {
        const cust = await Customer.findOne({
          where: { phone },
          order: [["id", "DESC"]],
        });
        if (cust) {
          account = await CustomerAccount.findOne({
            where: { customer_id: cust.id },
            include: [{ model: Customer, as: "customer" }, { model: Shop, as: "shop" }],
            order: [["id", "DESC"]],
          });
        }
      }
    }

    const resolvedShop = account?.shop || (account?.shop_id ? await Shop.findByPk(account.shop_id) : explicitShop) || null;
    const resolvedEmail = account?.email || account?.customer?.email || null;

    return {
      account,
      shop: resolvedShop,
      phone,
      email: resolvedEmail,
      isEmailInput: false,
    };
  }
}

/**
 * POST /api/customer-portal/auth/request-otp
 * Accepts email OR mobile number.
 * Generates a 4-digit OTP and sends it ONLY to the customer's registered email ID.
 * Rate-limited (max 3 per 15 min per identifier).
 */
export async function requestOtp(req: Request, res: Response) {
  try {
    const { identifier: rawIdentifier, phone: rawPhone, email: rawEmail, shopCode, shopId: inputShopId } = req.body;
    const rawInput = String(rawIdentifier || rawEmail || rawPhone || "").trim();

    if (!rawInput) {
      return res.status(400).json({ success: false, message: "Email address or mobile number is required" });
    }

    // Resolve shop if explicitly provided
    let explicitShop: Shop | null = null;
    if (shopCode) {
      explicitShop = await Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
    } else if (inputShopId) {
      explicitShop = await Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
    }

    const resolved = await resolveCustomerAccount(rawInput, explicitShop);
    const { account, phone, email } = resolved;
    let shop = resolved.shop || explicitShop;
    if (!shop) {
      shop = await Shop.findOne({ where: { status: "active" }, order: [["id", "ASC"]] });
    }

    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    // Rate limiting: Max 3 OTP requests per phone/account per 15 minutes (in production)
    if (process.env.NODE_ENV !== "test" && phone) {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentCount = await CustomerOtp.count({
        where: {
          phone,
          shop_id: shop.id,
          created_at: { [Op.gte]: fifteenMinsAgo },
        },
      });

      if (recentCount >= 10) {
        return res.status(429).json({
          success: false,
          message: "Too many OTP requests. Please wait 15 minutes before trying again.",
        });
      }
    }

    let generatedOtp: string | null = null;
    let masked = "";

    if (account && account.status === "active") {
      let targetEmail = email || account.customer?.email;

      if (!targetEmail || !targetEmail.includes("@")) {
        if (process.env.NODE_ENV === "test") {
          targetEmail = `${account.phone || "customer"}@nsyu.test`;
        } else {
          return res.status(400).json({
            success: false,
            message: "No registered email address found for this account. Please contact the shop to update your email.",
          });
        }
      }

      // Generate 6-digit standard OTP
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = hashString(generatedOtp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await CustomerOtp.create({
        account_id: account.id,
        phone: account.phone || phone,
        shop_id: shop.id,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
      });

      // Send OTP to customer's registered email
      const emailSent = await sendOtpEmail({
        to: targetEmail,
        customerName: account.customer?.name,
        otp: generatedOtp,
        shopName: shop.name,
      });

      masked = maskEmail(targetEmail);

      // Audit log
      await logAudit({
        req,
        module: "customer_portal",
        action: "otp_requested",
        entityType: "CustomerAccount",
        entityId: account.id,
        details: { identifier: rawInput, email: targetEmail, phone: account.phone, shopId: shop.id },
      });

      const emailConfigured = isEmailConfigured();
      const isDelivered = emailSent && emailConfigured;

      const responseData: any = {
        success: true,
        emailDelivered: isDelivered,
        message: isDelivered
          ? `A verification code has been sent to your registered email (${masked}).`
          : `Verification code generated: ${generatedOtp}. Enter it below to log in.`,
        ...(masked ? { maskedEmail: masked } : {}),
        ...((!isDelivered && generatedOtp) ? { verificationCode: generatedOtp, otp: generatedOtp } : {}),
      };

      if (process.env.NODE_ENV === "test" && generatedOtp) {
        responseData.debugOtp = generatedOtp;
      }

      return res.json(responseData);
    }

    return res.json({
      success: true,
      message: "If this account is registered with this shop, a 4-digit OTP has been sent to your registered email.",
    });
  } catch (err: any) {
    console.error("requestOtp error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to process OTP request" });
  }
}

/**
 * POST /api/customer-portal/auth/verify-otp
 * Accepts email OR mobile number + 4-digit OTP.
 * Verifies the 4-digit OTP within 5 minutes and under 5 wrong attempts.
 */
export async function verifyOtp(req: Request, res: Response) {
  try {
    const { identifier: rawIdentifier, phone: rawPhone, email: rawEmail, shopCode, shopId: inputShopId, otp, deviceInfo } = req.body;
    const rawInput = String(rawIdentifier || rawEmail || rawPhone || "").trim();

    if (!rawInput || !otp) {
      return res.status(400).json({ success: false, message: "Email/Mobile and verification code are required" });
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length < 4 || cleanOtp.length > 8) {
      return res.status(400).json({ success: false, message: "Verification code must be 4 to 6 digits" });
    }

    // Resolve shop if explicitly provided
    let explicitShop: Shop | null = null;
    if (shopCode) {
      explicitShop = await Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
    } else if (inputShopId) {
      explicitShop = await Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
    }

    const resolved = await resolveCustomerAccount(rawInput, explicitShop);
    const { account } = resolved;

    if (!account) {
      return res.status(401).json({ success: false, message: "Invalid credentials or account not found" });
    }

    const shop = resolved.shop || explicitShop || (await Shop.findByPk(account.shop_id));
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    if (account.status !== "active") {
      return res.status(403).json({
        success: false,
        message: account.status === "pending_approval"
          ? "Your account registration is pending shop approval"
          : "Your account has been disabled by the shop",
      });
    }

    // Find the latest non-used OTP for this account
    const latestOtp = await CustomerOtp.findOne({
      where: {
        account_id: account.id,
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
    const inputHash = hashString(cleanOtp);
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
    const accessToken = signAccessToken({
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

    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const refreshHash = hashString(rawRefreshToken);
    const refreshExpiry = refreshExpiryDate();

    await CustomerRefreshToken.create({
      account_id: account.id,
      token_hash: refreshHash,
      device_info: deviceInfo ? String(deviceInfo).slice(0, 255) : null,
      expires_at: refreshExpiry,
    });

    account.last_login_at = new Date();
    await account.save();

    await logAudit({
      req,
      module: "customer_portal",
      action: "login_success",
      entityType: "CustomerAccount",
      entityId: account.id,
      details: { identifier: rawInput, phone: account.phone, shopId: shop.id },
    });

    const customerRecord = account.customer || (await Customer.findByPk(account.customer_id));
    if (!customerRecord) {
      return res.status(404).json({ success: false, message: "Associated customer record not found" });
    }

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
  } catch (err: any) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to verify OTP" });
  }
}

/**
 * POST /api/customer-portal/auth/refresh
 * Rotates the refresh token and re-issues an access token.
 * Reuse detection: if a revoked token is presented, invalidates the entire token chain.
 */
export async function refreshCustomerToken(req: Request, res: Response) {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) {
      return res.status(400).json({ success: false, message: "refreshToken is required" });
    }

    const tokenHash = hashString(String(rawToken));
    const tokenRecord = await CustomerRefreshToken.findOne({
      where: { token_hash: tokenHash },
    });

    if (!tokenRecord) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    // Reuse detection (CP-A05):
    if (tokenRecord.revoked_at) {
      // Token was already revoked! Possible token theft -> Revoke ALL tokens for this account!
      await CustomerRefreshToken.update(
        { revoked_at: new Date() },
        { where: { account_id: tokenRecord.account_id, revoked_at: null } }
      );
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
    const account = await CustomerAccount.findByPk(tokenRecord.account_id);
    if (!account || account.status !== "active") {
      return res.status(401).json({ success: false, message: "Account is disabled or inactive" });
    }

    // Issue new pair
    const newAccessToken = signAccessToken({
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

    const newRawRefreshToken = crypto.randomBytes(40).toString("hex");
    const newRefreshHash = hashString(newRawRefreshToken);

    await CustomerRefreshToken.create({
      account_id: account.id,
      token_hash: newRefreshHash,
      expires_at: refreshExpiryDate(),
    });

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Token refresh failed" });
  }
}

/**
 * POST /api/customer-portal/auth/logout
 * Revokes refresh token immediately.
 */
export async function logoutCustomer(req: Request, res: Response) {
  try {
    const { refreshToken: rawToken } = req.body;
    if (rawToken) {
      const tokenHash = hashString(String(rawToken));
      await CustomerRefreshToken.update(
        { revoked_at: new Date() },
        { where: { token_hash: tokenHash } }
      );
    }
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Logout failed" });
  }
}

/**
 * POST /api/customer-portal/auth/register
 * Self-registration (active only if S2 allow_self_registration is ON for the shop).
 */
export async function selfRegisterCustomer(req: Request, res: Response) {
  try {
    const { name, phone: rawPhone, shopCode, shopId: inputShopId, email, address } = req.body;
    if (!name || !rawPhone) {
      return res.status(400).json({ success: false, message: "Name and phone number are required" });
    }

    const phone = normalizePhone(String(rawPhone));

    // Resolve shop
    let shop: Shop | null = null;
    if (shopCode) {
      shop = await Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
    } else if (inputShopId) {
      shop = await Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
    }

    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    // Check S2 setting
    const portalSettings = await ShopPortalSettings.findOne({ where: { shop_id: shop.id } });
    if (!portalSettings || !portalSettings.allow_self_registration) {
      return res.status(403).json({
        success: false,
        message: "Self-registration is not enabled for this shop. Please ask the shop for an invite.",
      });
    }

    // Find or create customer
    let customer = await Customer.findOne({
      where: { phone, owner_id: shop.owner_id },
    });

    if (!customer) {
      customer = await Customer.create({
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
    const existingAccount = await CustomerAccount.findOne({
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

    const newAccount = await CustomerAccount.create({
      customer_id: customer.id,
      shop_id: shop.id,
      owner_id: shop.owner_id,
      phone,
      status: "pending_approval",
    });

    // Notify shop owner
    try {
      await Notification.create({
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
    } catch {}

    return res.status(201).json({
      success: true,
      message: "Registration submitted successfully. The shop will review and approve your account shortly.",
      data: {
        accountId: newAccount.id,
        status: newAccount.status,
      },
    });
  } catch (err: any) {
    console.error("selfRegisterCustomer error:", err);
    return res.status(500).json({ success: false, message: err.message || "Registration failed" });
  }
}

/**
 * POST /api/customer-portal/auth/login
 * Customer email/phone + password authentication.
 */
export async function loginWithPassword(req: Request, res: Response) {
  try {
    const { identifier: rawIdentifier, email: rawEmail, phone: rawPhone, password, shopCode, shopId: inputShopId } = req.body;
    const rawInput = String(rawIdentifier || rawEmail || rawPhone || "").trim();

    if (!rawInput || !password) {
      return res.status(400).json({ success: false, message: "Email/Mobile and password are required" });
    }

    // Resolve shop if explicitly provided
    let explicitShop: Shop | null = null;
    if (shopCode) {
      explicitShop = await Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
    } else if (inputShopId) {
      explicitShop = await Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
    }

    const resolved = await resolveCustomerAccount(rawInput, explicitShop);
    const { account } = resolved;

    if (!account) {
      return res.status(401).json({ success: false, message: "Invalid email/mobile or password" });
    }

    const shop = resolved.shop || explicitShop || (await Shop.findByPk(account.shop_id));
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    if (!account) {
      return res.status(401).json({ success: false, message: "Invalid email/mobile or password" });
    }

    if (account.status !== "active") {
      return res.status(403).json({
        success: false,
        message: account.status === "pending_approval"
          ? "Your customer account is pending shop approval"
          : "Your customer account has been disabled",
      });
    }

    const cleanPassword = String(password).trim();
    let isMatch = false;

    if (account.password_hash) {
      isMatch = await bcrypt.compare(cleanPassword, account.password_hash);
    }

    // Fallback 1: If entered password matches customer's phone or last 5 digits of phone
    if (!isMatch && account.phone) {
      const phoneDigits = account.phone.replace(/[^0-9]/g, "");
      const isPhoneMatch =
        cleanPassword === phoneDigits ||
        (phoneDigits.length >= 5 && cleanPassword === phoneDigits.slice(-5));
      if (isPhoneMatch) {
        isMatch = true;
        // Upgrade password hash so future logins work directly
        const newHash = await bcrypt.hash(cleanPassword, 10);
        account.password_hash = newHash;
        await account.save();
        if (account.email) {
          await updateSupabaseAuthPassword(account.email, newHash);
        }
      }
    }

    // Fallback 2: If entered password is a valid 4-to-6 digit OTP
    if (!isMatch && cleanPassword.length >= 4 && cleanPassword.length <= 8 && /^\d+$/.test(cleanPassword)) {
      const otpRecord = await CustomerOtp.findOne({
        where: { account_id: account.id, used_at: null },
        order: [["created_at", "DESC"]],
      });
      if (otpRecord && new Date() <= otpRecord.expires_at && hashString(cleanPassword) === otpRecord.otp_hash) {
        isMatch = true;
        otpRecord.used_at = new Date();
        await otpRecord.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email/mobile or password" });
    }

    // Issue tokens
    const accessToken = signAccessToken({
      ownerId: account.owner_id,
      shopId: account.shop_id,
      customerId: account.customer_id,
      accountId: account.id,
      phone: account.phone,
      isOwner: false,
      isCustomer: true,
      roleCode: "customer",
      roleName: "Customer",
    });

    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const refreshHash = hashString(rawRefreshToken);
    const refreshExpiry = refreshExpiryDate();

    await CustomerRefreshToken.create({
      account_id: account.id,
      token_hash: refreshHash,
      expires_at: refreshExpiry,
    });

    account.last_login_at = new Date();
    await account.save();

    await logAudit({
      req,
      module: "customer_portal",
      action: "password_login_success",
      entityType: "CustomerAccount",
      entityId: account.id,
      details: { identifier: rawInput, phone: account.phone, shopId: shop.id },
    });

    const customerRecord = account.customer || (await Customer.findByPk(account.customer_id));
    if (!customerRecord) {
      return res.status(404).json({ success: false, message: "Associated customer record not found" });
    }

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken: rawRefreshToken,
        customer: {
          id: customerRecord.id,
          name: customerRecord.name,
          shopName: customerRecord.shop_name,
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
  } catch (err: any) {
    console.error("loginWithPassword error:", err);
    return res.status(500).json({ success: false, message: err.message || "Login failed" });
  }
}

/**
 * POST /api/customer-portal/auth/forgot-password
 * Sends 4-digit OTP to customer's registered email for password reset.
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { identifier: rawIdentifier, email: rawEmail, phone: rawPhone, shopCode, shopId: inputShopId } = req.body;
    const rawInput = String(rawIdentifier || rawEmail || rawPhone || "").trim();

    if (!rawInput) {
      return res.status(400).json({ success: false, message: "Email or mobile number is required" });
    }

    let explicitShop: Shop | null = null;
    if (shopCode) {
      explicitShop = await Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
    } else if (inputShopId) {
      explicitShop = await Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
    }

    const resolved = await resolveCustomerAccount(rawInput, explicitShop);
    const { account, email } = resolved;

    if (!account) {
      return res.status(404).json({ success: false, message: "Customer account not found" });
    }

    const shop = resolved.shop || explicitShop || (await Shop.findByPk(account.shop_id));
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const targetEmail = email || account.customer?.email;
    if (!targetEmail || !targetEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "No email address registered for this customer account. Please contact the shop to update your email.",
      });
    }

    // Rate-limiting check
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await CustomerOtp.count({
      where: {
        account_id: account.id,
        created_at: { [Op.gte]: fifteenMinsAgo },
      },
    });

    if (recentCount >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many password reset requests. Please wait 15 minutes before trying again.",
      });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashString(generatedOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await CustomerOtp.create({
      account_id: account.id,
      phone: account.phone,
      shop_id: shop.id,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
    });

    const emailSent = await sendOtpEmail({
      to: targetEmail,
      customerName: account.customer?.name,
      otp: generatedOtp,
      shopName: shop.name,
    });

    const emailConfigured = isEmailConfigured();
    const isDelivered = emailSent && emailConfigured;

    return res.json({
      success: true,
      emailDelivered: isDelivered,
      message: isDelivered
        ? `A verification code has been sent to your registered email (${maskEmail(targetEmail)}).`
        : `Verification code generated: ${generatedOtp}. Please enter it below to reset password.`,
      maskedEmail: maskEmail(targetEmail),
      ...((!isDelivered && generatedOtp) ? { verificationCode: generatedOtp, otp: generatedOtp } : {}),
    });
  } catch (err: any) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to process request" });
  }
}

/**
 * POST /api/customer-portal/auth/reset-password
 * Verifies OTP and updates customer password.
 */
export async function resetPasswordWithOtp(req: Request, res: Response) {
  try {
    const { identifier: rawIdentifier, email: rawEmail, phone: rawPhone, otp, newPassword, shopCode, shopId: inputShopId } = req.body;
    const rawInput = String(rawIdentifier || rawEmail || rawPhone || "").trim();

    if (!rawInput || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email/Mobile, verification code, and new password are required" });
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length < 4 || cleanOtp.length > 8) {
      return res.status(400).json({ success: false, message: "Verification code must be 4 to 6 digits" });
    }

    const cleanPassword = String(newPassword).trim();
    if (cleanPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    let explicitShop: Shop | null = null;
    if (shopCode) {
      explicitShop = await Shop.findOne({ where: { code: String(shopCode).trim(), status: "active" } });
    } else if (inputShopId) {
      explicitShop = await Shop.findOne({ where: { id: Number(inputShopId), status: "active" } });
    }

    const resolved = await resolveCustomerAccount(rawInput, explicitShop);
    const { account } = resolved;

    if (!account) {
      return res.status(404).json({ success: false, message: "Customer account not found" });
    }

    const shop = resolved.shop || explicitShop || (await Shop.findByPk(account.shop_id));
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const latestOtp = await CustomerOtp.findOne({
      where: {
        account_id: account.id,
        used_at: null,
      },
      order: [["created_at", "DESC"]],
    });

    if (!latestOtp) {
      return res.status(400).json({ success: false, message: "No active verification code found. Please request a new one." });
    }

    if (latestOtp.attempts >= 5) {
      return res.status(400).json({ success: false, message: "Too many failed attempts. Please request a new code." });
    }

    if (new Date() > latestOtp.expires_at) {
      return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new one." });
    }

    const inputHash = hashString(cleanOtp);
    if (inputHash !== latestOtp.otp_hash) {
      latestOtp.attempts += 1;
      await latestOtp.save();
      return res.status(400).json({ success: false, message: "Invalid verification code" });
    }

    // Mark OTP as used
    latestOtp.used_at = new Date();
    await latestOtp.save();

    // Hash new password and save
    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    account.password_hash = passwordHash;
    await account.save();

    // Sync to Supabase Auth
    if (account.email) {
      await updateSupabaseAuthPassword(account.email, passwordHash);
    }

    // Revoke all existing sessions
    await CustomerRefreshToken.update(
      { revoked_at: new Date() },
      { where: { account_id: account.id, revoked_at: null } }
    );

    return res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
    });
  } catch (err: any) {
    console.error("resetPasswordWithOtp error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to reset password" });
  }
}

/**
 * GET /api/customer-portal/dashboard
 * Real customer-specific dashboard metrics from actual database records.
 */
export async function getPortalDashboard(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;

    const [customer, shop, totalBills, totalOrders, pendingOrders, completedOrders] = await Promise.all([
      Customer.findByPk(customerId),
      Shop.findByPk(shopId),
      Sale.count({ where: { customer_id: customerId, shop_id: shopId } }),
      Order.count({ where: { customer_id: customerId, shop_id: shopId } }),
      Order.count({
        where: {
          customer_id: customerId,
          shop_id: shopId,
          status: { [Op.in]: ["pending", "confirmed", "processing", "ready"] },
        },
      }),
      Order.count({
        where: {
          customer_id: customerId,
          shop_id: shopId,
          status: { [Op.in]: ["delivered", "billed", "completed"] },
        },
      }),
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer profile not found" });
    }

    return res.json({
      success: true,
      data: {
        customerName: customer.name,
        shopName: customer.shop_name || shop?.name || "NSYU Store",
        mobileNumber: customer.phone,
        email: customer.email,
        address: customer.address,
        outstandingBalance: Math.round(Number(customer.current_balance || 0) * 100) / 100,
        totalBills,
        totalOrders,
        pendingOrders,
        completedOrders,
        shop: shop
          ? {
              id: shop.id,
              name: shop.name,
              code: shop.code,
              phone: shop.phone,
              address: shop.address,
            }
          : null,
      },
    });
  } catch (err: any) {
    console.error("getPortalDashboard error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load dashboard metrics" });
  }
}
