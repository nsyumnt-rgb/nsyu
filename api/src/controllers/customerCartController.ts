import { Request, Response } from "express";
import { CustomerCart, CustomerCartItem, Product, ProductStock, ProductImage, Category } from "../models";

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

      const rate = round2(Number(product.selling_price || 0));
      const discPercent = round2(Number(product.discount || 0));
      const gstPercent = round2(Number(product.tax_percent || 0));

      const lineGross = round2(rate * qty);
      const lineDisc = round2((lineGross * discPercent) / 100);
      const lineTaxable = Math.max(0, round2(lineGross - lineDisc));
      const lineTax = round2((lineTaxable * gstPercent) / 100);
      const lineTotal = round2(lineTaxable + lineTax);

      subtotal = round2(subtotal + lineTaxable);
      taxAmount = round2(taxAmount + lineTax);
      totalDiscount = round2(totalDiscount + lineDisc);

      const stockRow = product.stocks?.[0];
      const availableStock = stockRow ? Number(stockRow.current_stock || 0) : 0;
      const exceedsStock = qty > availableStock;

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
        warning: exceedsStock ? `Only ${availableStock} units available` : undefined,
        isUnavailable: exceedsStock || availableStock <= 0,
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
      where: { id: productId, owner_id: ownerId, status: "active" },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Verify stock availability
    const stock = await ProductStock.findOne({
      where: { product_id: productId, shop_id: shopId },
    });
    const currentStock = stock ? Number(stock.current_stock || 0) : 0;

    if (qty > currentStock) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity exceeds available stock (${currentStock} available)`,
        availableStock: currentStock,
      });
    }

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
