/**
 * Small, fire-and-forget entry points the existing business flows call after they commit.
 * They never throw and never slow the original request down.
 */
import { QueryTypes } from "sequelize";
import { sequelize } from "../../models";
import { triggerAutomation, runAutomation, inr, WEB_URL } from "./engine";
import { resolveRules, getSettingsRow } from "./settings";

const safe = (fn: () => void) => {
  try {
    fn();
  } catch (err: any) {
    console.warn("[MESSAGING] hook error:", err?.message || err);
  }
};

export function onInvoiceCreated(sale: any) {
  safe(() => {
    if (!sale?.customer_id || !sale?.shop_id) return;
    const firstItem = (sale.items || [])[0]?.product_name;
    triggerAutomation("invoice_generated", {
      ownerId: sale.owner_id,
      shopId: sale.shop_id,
      customerId: sale.customer_id,
      reference: { type: "sale", id: Number(sale.id) },
      vars: {
        order_number: sale.invoice_number,
        order_amount: inr(sale.total_amount),
        due_amount: inr(sale.due_amount),
        invoice_link: `${WEB_URL()}/#/portal/bills/${sale.id}`,
        product_name: firstItem || "",
      },
    });
  });
}

export function onPaymentReceived(p: {
  ownerId: number;
  shopId: number;
  customerId: number;
  amount: number;
  entryId?: number | string | null;
  invoiceNumber?: string | null;
  saleId?: number | null;
  balance?: number | null;
}) {
  safe(() => {
    if (!p.customerId || !p.shopId || !(Number(p.amount) > 0)) return;
    triggerAutomation("payment_received", {
      ownerId: p.ownerId,
      shopId: p.shopId,
      customerId: p.customerId,
      reference: p.entryId ? { type: "payment", id: Number(p.entryId) } : p.saleId ? { type: "sale_payment", id: Number(p.saleId) } : null,
      vars: {
        payment_amount: inr(p.amount),
        order_number: p.invoiceNumber || "",
        ...(p.balance !== undefined && p.balance !== null ? { due_amount: inr(Math.max(0, Number(p.balance))) } : {}),
        ...(p.saleId ? { invoice_link: `${WEB_URL()}/#/portal/bills/${p.saleId}` } : {}),
      },
    });
  });
}

const ORDER_EVENTS: Record<string, "order_confirmed" | "order_dispatched" | "order_delivered"> = {
  confirmed: "order_confirmed",
  shipped: "order_dispatched",
  delivered: "order_delivered",
};

export function onOrderStatusChanged(order: any, status: string) {
  safe(() => {
    const event = ORDER_EVENTS[String(status).toLowerCase()];
    if (!event || !order?.customer_id || !order?.shop_id) return;
    triggerAutomation(event, {
      ownerId: order.owner_id,
      shopId: order.shop_id,
      customerId: order.customer_id,
      reference: { type: "order", id: Number(order.id) },
      vars: {
        order_number: order.order_number,
        order_amount: inr(order.total_amount),
        order_tracking_link: `${WEB_URL()}/#/portal/orders/${order.id}`,
        product_name: (order.items || [])[0]?.product_name || "",
      },
    });
  });
}

export function onCustomerRegistered(ownerId: number, shopId: number | null | undefined, customerId: number) {
  safe(() => {
    if (!shopId || !customerId) return;
    triggerAutomation("customer_registration", { ownerId, shopId, customerId, key: `c:${customerId}` });
  });
}

/**
 * New offer: a product's selling price drops below its MRP or below its previous price.
 * Goes to customers who bought from the same category at this shop in the last 180 days,
 * with promotional consent. Once per product per price.
 */
export function onProductPriceDropped(product: any, previousPrice: number, shopId: number | null | undefined) {
  setImmediate(async () => {
    try {
      const price = Number(product?.selling_price || 0);
      const mrp = Number(product?.mrp || 0);
      if (!shopId || !product?.category_id || !(price > 0) || !(price < previousPrice) || (mrp && price >= mrp && price >= previousPrice)) return;
      const rule = resolveRules(await getSettingsRow(shopId)).offers_promotions;
      if (!rule.whatsapp && !rule.email) return;
      const rows: any[] = await sequelize.query(
        `SELECT DISTINCT s.customer_id AS customer_id FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
           JOIN products p ON p.id = si.product_id
          WHERE s.owner_id = :ownerId AND s.shop_id = :shopId AND s.status <> 'cancelled'
            AND p.category_id = :categoryId AND s.invoice_date >= :since`,
        {
          replacements: { ownerId: product.owner_id, shopId, categoryId: product.category_id, since: new Date(Date.now() - 180 * 86400000) },
          type: QueryTypes.SELECT,
        }
      );
      const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
      for (const r of rows.slice(0, 2000)) {
        await runAutomation("offers_promotions", {
          ownerId: product.owner_id,
          shopId,
          customerId: Number(r.customer_id),
          reference: { type: "product", id: Number(product.id) },
          key: `product:${product.id}:price:${price.toFixed(2)}:c:${r.customer_id}`,
          vars: {
            product_name: `${product.name} now ${inr(price)}${off ? ` (${off}% off)` : ""}`,
            order_amount: inr(price),
            order_tracking_link: `${WEB_URL()}/#/market/p/${shopId}/${product.id}`,
          },
        });
      }
    } catch (err: any) {
      console.warn("[MESSAGING] offer automation failed:", err?.message || err);
    }
  });
}

