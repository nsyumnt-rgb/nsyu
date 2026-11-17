import { Request, Response } from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { sequelize, CustomerAccount, Customer, Shop, ShopPortalSettings } from "../models";
import { getCart, setCartItem } from "./customerCartController";
import { notifyOwner } from "../utils/notifications";

/**
 * MULTISHOP CART (phase 1, step 3) — one cart grouped by shop.
 *
 * A person has one CustomerAccount per shop (each with its own khata). Accounts
 * of the same person share `identity_group` (migration 05). The group is
 * extended ONLY when the signed-in customer adds an item from a new shop here;
 * accounts are never merged by matching phone numbers.
 *
 * Per-shop cart logic is NOT duplicated: the existing customer-portal handlers
 * (getCart / setCartItem) are run with that shop's account as the customer
 * context, so stock checks, pricing and GST stay identical to the portal.
 */

type Handler = (req: Request, res: Response) => Promise<any>;

/** Runs an existing portal handler as a given account and captures its JSON response. */
async function runAs(handler: Handler, req: Request, account: CustomerAccount, extra: { params?: any; body?: any } = {}) {
  let status = 200;
  let body: any = null;
  const fakeReq = {
    ...req,
    headers: req.headers,
    query: {},
    params: { ...(extra.params || {}) },
    body: extra.body ?? {},
    customer: {
      customerId: account.customer_id,
      shopId: account.shop_id,
      ownerId: account.owner_id,
      accountId: Number(account.id),
      phone: account.phone,
    },
  } as unknown as Request;
  const fakeRes = {
    status(code: number) {
      status = code;
      return fakeRes;
    },
    json(payload: any) {
      body = payload;
      return fakeRes;
    },
  } as unknown as Response;
  await handler(fakeReq, fakeRes);
  return { status, body };
}

/** The signed-in account, with an identity group assigned on first use. */
async function currentAccount(req: Request): Promise<CustomerAccount> {
  const acc = await CustomerAccount.findByPk(req.customer!.accountId);
  if (!acc) throw Object.assign(new Error("Customer account not found"), { status: 401 });
  if (!acc.identity_group) {
    acc.identity_group = crypto.randomUUID();
    await acc.save();
  }
  return acc;
}

async function groupAccounts(group: string) {
  return CustomerAccount.findAll({
    where: { identity_group: group, status: { [Op.in]: ["active", "pending_approval"] } },
    include: [{ model: Shop, as: "shop", attributes: ["id", "name", "code", "status"] }],
    order: [["id", "ASC"]],
  });
}

/**
 * Finds (or creates, on first add) this person's account at `shopId`.
 * Refuses when the shop already holds a customer record with the same mobile
 * or email: that record and its khata belong to the shop and must be linked by
 * the shop, not claimed automatically.
 */
async function accountForShop(base: CustomerAccount, shopId: number): Promise<CustomerAccount> {
  if (Number(base.shop_id) === shopId) return base;
  const existing = await CustomerAccount.findOne({ where: { identity_group: base.identity_group, shop_id: shopId } });
  if (existing) return existing;

  const shop = await Shop.findOne({ where: { id: shopId, status: "active" } });
  if (!shop) throw Object.assign(new Error("Shop not found"), { status: 404 });
  const settings = await ShopPortalSettings.findOne({ where: { shop_id: shopId } });
  if (settings && !settings.allow_orders) {
    throw Object.assign(new Error(`${shop.name} is not taking online orders right now`), { status: 400 });
  }

  const me = await Customer.findByPk(base.customer_id);
  if (!me) throw Object.assign(new Error("Customer profile not found"), { status: 404 });
  const phone = String(base.phone || me.phone || "").trim();
  const email = String(base.email || me.email || "").trim().toLowerCase() || null;

  const clash = await Customer.findOne({
    where: {
      owner_id: shop.owner_id,
      [Op.or]: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [sequelize.where(sequelize.fn("lower", sequelize.col("email")), email)] : []),
      ],
    },
  });
  if (clash) {
    throw Object.assign(
      new Error(`${shop.name} already has a customer record with your mobile or email. Ask the shop to enable portal access for you, then log in with that shop once.`),
      { status: 409, code: "SHOP_RECORD_EXISTS" }
    );
  }

  const needsApproval = settings ? settings.allow_self_registration === false : false;
  const created = await sequelize.transaction(async (t) => {
    const customer = await Customer.create(
      { owner_id: shop.owner_id, name: me.name, phone: phone || null, email, address: me.address ?? null } as any,
      { transaction: t }
    );
    return CustomerAccount.create(
      {
        customer_id: customer.id,
        shop_id: shop.id,
        owner_id: shop.owner_id,
        phone,
        email,
        password_hash: base.password_hash ?? null, // same login works at every linked shop
        status: needsApproval ? "pending_approval" : "active",
        identity_group: base.identity_group,
      },
      { transaction: t }
    );
  });

  notifyOwner(shop.owner_id, {
    shopId: shop.id,
    type: needsApproval ? "approval_needed" : "general",
    title: needsApproval ? "New online customer awaiting approval" : "New online customer",
    message: `${me.name} started shopping at ${shop.name} from the marketplace.`,
    referenceType: "CustomerAccount",
    referenceId: Number(created.id),
  });
  return created;
}

/** Builds the grouped cart: one entry per linked shop that has items (or is pending approval). */
async function groupedCart(req: Request, base: CustomerAccount) {
  const accounts = await groupAccounts(base.identity_group!);
  const groups: any[] = [];
  for (const acc of accounts) {
    const shop = (acc as any).shop;
    if (!shop || shop.status !== "active") continue;
    if (acc.status !== "active") {
      groups.push({ shop: { id: shop.id, name: shop.name, code: shop.code }, status: acc.status, cart: null });
      continue;
    }
    const { status, body } = await runAs(getCart as Handler, req, acc);
    if (status !== 200 || !body?.data) continue;
    if (!body.data.items?.length) continue;
    groups.push({ shop: { id: shop.id, name: shop.name, code: shop.code }, status: "active", cart: body.data });
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    groups,
    itemCount: groups.reduce((a, g) => a + (g.cart?.itemCount || 0), 0),
    total: r2(groups.reduce((a, g) => a + Number(g.cart?.estimatedTotal || 0), 0)),
  };
}

function fail(res: Response, err: any, fallback: string) {
  return res.status(err.status || 500).json({ success: false, message: err.message || fallback, code: err.code });
}

/** GET /api/customer-portal/market/cart */
export async function getMarketCart(req: Request, res: Response) {
  try {
    const base = await currentAccount(req);
    return res.json({ success: true, data: await groupedCart(req, base) });
  } catch (err) {
    return fail(res, err, "Could not load cart");
  }
}

/** PUT /api/customer-portal/market/cart/:shopId/items/:productId  { quantity } — 0 removes. */
export async function setMarketCartItem(req: Request, res: Response) {
  try {
    const shopId = Number(req.params.shopId);
    const productId = Number(req.params.productId);
    if (!shopId || !productId) return res.status(400).json({ success: false, message: "shopId and productId are required" });
    const qty = Number(req.body?.quantity);
    if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ success: false, message: "Quantity must be a whole number" });

    const base = await currentAccount(req);
    // Removing never creates a new shop account.
    const acc =
      qty === 0
        ? Number(base.shop_id) === shopId
          ? base
          : await CustomerAccount.findOne({ where: { identity_group: base.identity_group, shop_id: shopId } })
        : await accountForShop(base, shopId);

    if (acc && qty > 0 && acc.status !== "active") {
      return res.status(403).json({ success: false, code: "AWAITING_APPROVAL", message: "This shop must approve your account before you can order. You'll be notified." });
    }
    if (acc) {
      const { status, body } = await runAs(setCartItem as Handler, req, acc, { params: { productId }, body: { quantity: qty } });
      if (status >= 400) return res.status(status).json(body);
    }
    return res.json({ success: true, data: await groupedCart(req, base) });
  } catch (err) {
    return fail(res, err, "Could not update cart");
  }
}
