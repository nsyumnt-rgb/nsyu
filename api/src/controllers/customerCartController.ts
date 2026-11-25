import { Request, Response } from "express";
import { marketplaceVisibleWhere } from "../utils/productVisibility";
import { CustomerCart, CustomerCartItem, Product, ProductStock, ProductImage, Category, Shop } from "../models";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getCart(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const ownerId = req.customer!.ownerId;

    let [cart] = await CustomerCart.findOrCreate({
      where: { customer_id: customerId, shop_id: shopId },
      defaults: { customer_id: customerId, shop_id: shopId },
    });

    const cartItems = await CustomerCartItem.findAll({
      where: { cart_id: cart.id },
      include: [
        {
          model: Product,
          as: "product",
          include: [
            { model: Category, as: "category", attributes: ["id", "name"] },
            { model: ProductImage, as: "images", attributes: ["url", "is_primary"] },
            {
              model: ProductStock,
              as: "stocks",
              where: { shop_id: shopId },
              required: false,
              attributes: ["current_stock"],
            },
          ],
        },
      ],
      order: [["id", "ASC"]],
    });

    const shopRow = await Shop.findByPk(shopId);
    const shopSettings = (shopRow?.settings || {}) as any;
    const allowNegativeStock = shopSettings.allowNegativeStock !== undefined ? Boolean(shopSettings.allowNegativeStock) : true;
    const shopDefaultGst = Number(shopSettings.defaultGstRate ?? 0);

    let subtotal = 0;
    let taxAmount = 0;
    let totalDiscount = 0;
    const items: any[] = [];

    for (const item of cartItems) {
      const product = (item as any).product;
      const qty = Number(item.quantity);

      if (!product || product.status !== "active") {
        items.push({
          id: item.id,
          productId: item.product_id,
          quantity: qty,
          warning: "unavailable",
          isUnavailable: true,
          product: product ? { id: product.id, name: product.name, sku: product.sku } : null,
        });
        continue;
      }

      const effectivePrice = product.live_price && Number(product.live_price) > 0 ? product.live_price : product.selling_price;
      const rate = round2(Number(effectivePrice || 0));
      const discPercent = round2(Number(product.discount || 0));
      const gstPercent = shopDefaultGst > 0 ? round2(Number(product.tax_percent) || shopDefaultGst) : 0;

      const lineGross = round2(rate * qty);
      const lineDisc = round2((lineGross * discPercent) / 100);
      const lineTaxable = Math.max(0, round2(lineGross - lineDisc));
      const lineTax = round2((lineTaxable * gstPercent) / 100);
      const lineTotal = round2(lineTaxable + lineTax);

      subtotal = round2(subtotal + lineTaxable);
      taxAmount = round2(taxAmount + lineTax);
      totalDiscount = round2(totalDiscount + lineDisc);

      const stockRow = product.stocks?.[0];
      const rawStock = stockRow ? Number(stockRow.current_stock || 0) : 0;
      const availableStock = rawStock > 0 ? rawStock : 999;

      let warning: string | undefined = undefined;
      if (rawStock <= 0) {
        warning = "Low/out of shop stock — shop will arrange for you";
      } else if (rawStock < qty) {
        warning = `Only ${rawStock} in shop — shop will arrange remaining`;
      }

      const primaryImg = product.images?.find((i: any) => i.is_primary) || product.images?.[0];

      items.push({
        id: item.id,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        brand: product.brand,
        category: (product as any).category?.name || product.brand || null,
        imageUrl: primaryImg ? primaryImg.url : null,
        quantity: qty,
        unitPrice: rate,
        discountPercent: discPercent,
        discountAmount: lineDisc,
        gstPercent: gstPercent,
        taxAmount: lineTax,
        lineTotal: lineTotal,
        availableStock,
        warning,
        isUnavailable: false,
      });
    }

    const estimatedTotal = round2(subtotal + taxAmount);

    return res.json({
      success: true,
      data: {
        cartId: cart.id,
        items,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount,
        estimatedTotal,
        itemCount: items.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load cart" });
  }
}

export async function setCartItem(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const ownerId = req.customer!.ownerId;
    const productId = Number(req.params.productId);
    const { quantity } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ success: false, message: "quantity is required" });
    }

    const qty = Number(quantity);

    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive number" });
    }

    // Must be integer (CP-C03)
    if (!Number.isInteger(qty)) {
      return res.status(400).json({ success: false, message: "Quantity must be a whole number" });
    }

    let [cart] = await CustomerCart.findOrCreate({
      where: { customer_id: customerId, shop_id: shopId },
      defaults: { customer_id: customerId, shop_id: shopId },
    });

    if (qty === 0) {
      await CustomerCartItem.destroy({
        where: { cart_id: cart.id, product_id: productId },
      });
      return getCart(req, res);
    }

    // Verify product exists and is active for this owner
    const product = await Product.findOne({
      where: { id: productId, owner_id: ownerId, status: "active", ...marketplaceVisibleWhere() },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Verify stock availability
    const shop = await Shop.findByPk(shopId);
    const shopSettings = (shop?.settings || {}) as any;
    const allowNegativeStock = shopSettings.allowNegativeStock !== undefined ? Boolean(shopSettings.allowNegativeStock) : true;

    const stock = await ProductStock.findOne({
      where: { product_id: productId, shop_id: shopId },
    });
    const currentStock = stock ? Number(stock.current_stock || 0) : 0;

    // Note: Online orders allow adding to cart even if stock is low or 0,
    // so the shop can arrange the products from distributors upon order.

    // Upsert cart item
    const existingItem = await CustomerCartItem.findOne({
      where: { cart_id: cart.id, product_id: productId },
    });

    if (existingItem) {
      existingItem.quantity = qty;
      await existingItem.save();
    } else {
      await CustomerCartItem.create({
        cart_id: cart.id,
        product_id: productId,
        quantity: qty,
      });
    }

    cart.changed("updated_at", true);
    await cart.save();

    return getCart(req, res);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update cart" });
  }
}

export async function removeCartItem(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;
    const productId = Number(req.params.productId);

    const cart = await CustomerCart.findOne({
      where: { customer_id: customerId, shop_id: shopId },
    });

    if (cart) {
      await CustomerCartItem.destroy({
        where: { cart_id: cart.id, product_id: productId },
      });
    }

    return getCart(req, res);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to remove cart item" });
  }
}

export async function clearCart(req: Request, res: Response) {
  try {
    const customerId = req.customer!.customerId;
    const shopId = req.customer!.shopId;

    const cart = await CustomerCart.findOne({
      where: { customer_id: customerId, shop_id: shopId },
    });

    if (cart) {
      await CustomerCartItem.destroy({
        where: { cart_id: cart.id },
      });
    }

    return res.json({ success: true, message: "Cart emptied successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to clear cart" });
  }
}
