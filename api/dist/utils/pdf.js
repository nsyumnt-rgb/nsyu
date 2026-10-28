"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamBillPdf = streamBillPdf;
exports.streamReceiptPdf = streamReceiptPdf;
exports.streamPurchasePdf = streamPurchasePdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
const INR = (n) => `Rs. ${Number(n).toFixed(2)}`;
/**
 * Streams a printable/downloadable invoice PDF directly to the HTTP
 * response. `sale` must be loaded with its `items`, `customer`,
 * `shop`, and `payments` associations.
 */
function streamBillPdf(res, sale) {
    const doc = new pdfkit_1.default({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${sale.invoice_number}.pdf"`);
    doc.pipe(res);
    // Header — shop details
    doc.fontSize(18).text(sale.shop?.name || "Shop", { continued: false });
    doc.fontSize(9).fillColor("#555");
    if (sale.shop?.address)
        doc.text(sale.shop.address);
    const shopContact = [sale.shop?.phone, sale.shop?.email].filter(Boolean).join("  |  ");
    if (shopContact)
        doc.text(shopContact);
    doc.fillColor("#000");
    doc.moveDown(1);
    doc.fontSize(14).text("TAX INVOICE", { align: "right" });
    doc.fontSize(10);
    doc.text(`Invoice #: ${sale.invoice_number}`, { align: "right" });
    doc.text(`Date: ${new Date(sale.invoice_date).toLocaleString("en-IN")}`, { align: "right" });
    doc.text(`Status: ${sale.status.toUpperCase()}${sale.is_emi ? " (EMI)" : ""}`, { align: "right" });
    doc.moveDown(1);
    doc.fontSize(11).text("Bill To:");
    doc.fontSize(10);
    doc.text(sale.customer?.name || "Walk-in Customer");
    if (sale.customer?.phone)
        doc.text(sale.customer.phone);
    if (sale.customer?.address)
        doc.text(sale.customer.address);
    doc.moveDown(1);
    // Items table
    const tableTop = doc.y;
    const cols = { name: 40, qty: 240, rate: 290, disc: 350, tax: 410, total: 470 };
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Product", cols.name, tableTop);
    doc.text("Qty", cols.qty, tableTop);
    doc.text("Rate", cols.rate, tableTop);
    doc.text("Disc", cols.disc, tableTop);
    doc.text("Tax", cols.tax, tableTop);
    doc.text("Total", cols.total, tableTop);
    doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).stroke();
    let y = tableTop + 20;
    doc.font("Helvetica");
    for (const item of sale.items || []) {
        doc.text(item.product_name, cols.name, y, { width: 190 });
        doc.text(String(item.quantity), cols.qty, y);
        doc.text(Number(item.rate).toFixed(2), cols.rate, y);
        doc.text(Number(item.discount_amount).toFixed(2), cols.disc, y);
        doc.text(Number(item.tax_amount).toFixed(2), cols.tax, y);
        doc.text(Number(item.total_amount).toFixed(2), cols.total, y);
        y += 18;
    }
    doc.moveTo(40, y).lineTo(555, y).stroke();
    y += 10;
    // Totals
    const totalsX = 380;
    doc.fontSize(10);
    const line = (label, value, bold = false) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica");
        doc.text(label, totalsX, y, { width: 100 });
        doc.text(value, cols.total, y);
        y += 16;
    };
    line("Subtotal", INR(sale.subtotal));
    line("Discount", `- ${INR(sale.discount_amount)}`);
    line("Tax", `+ ${INR(sale.tax_amount)}`);
    line("Total", INR(sale.total_amount), true);
    line("Paid", INR(sale.paid_amount));
    line("Due", INR(sale.due_amount), true);
    y += 8;
    doc.font("Helvetica").fontSize(9);
    doc.text(`Payment Method: ${sale.payment_method.replace("_", " ").toUpperCase()}`, 40, y);
    y += 20;
    if (sale.payments?.length) {
        doc.font("Helvetica-Bold").text("Payments Received:", 40, y);
        y += 16;
        doc.font("Helvetica");
        for (const p of sale.payments) {
            if (p.status === "cancelled")
                continue;
            doc.text(`${new Date(p.payment_date).toLocaleDateString("en-IN")} — ${p.method.replace("_", " ")} — ${INR(p.amount)}${p.transaction_id ? ` (Txn: ${p.transaction_id})` : ""}`, 40, y);
            y += 14;
        }
    }
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#777").text("This is a computer generated invoice.", 40, doc.y, { align: "center" });
    doc.end();
}
/** Streams a payment receipt PDF (for a single sale payment or an EMI installment payment). */
function streamReceiptPdf(res, payment) {
    const doc = new pdfkit_1.default({ size: "A5", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${payment.id}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).text(payment.shop?.name || "Payment Receipt");
    doc.fontSize(9).fillColor("#555");
    if (payment.shop?.address)
        doc.text(payment.shop.address);
    doc.fillColor("#000");
    doc.moveDown(1);
    doc.fontSize(13).text("PAYMENT RECEIPT", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(10);
    doc.text(`Receipt #: PMT-${payment.id}`);
    doc.text(`Date: ${new Date(payment.payment_date).toLocaleString("en-IN")}`);
    doc.text(`Customer: ${payment.customer?.name || "-"}`);
    if (payment.sale_id)
        doc.text(`Against Invoice: ${payment.sale?.invoice_number || payment.sale_id}`);
    if (payment.emi_installment_id)
        doc.text(`EMI Installment #: ${payment.installment?.installment_number ?? payment.emi_installment_id}`);
    doc.text(`Type: ${payment.type.replace("_", " ").toUpperCase()}`);
    doc.text(`Method: ${payment.method.replace("_", " ").toUpperCase()}`);
    if (payment.transaction_id)
        doc.text(`Transaction ID: ${payment.transaction_id}`);
    doc.text(`Status: ${payment.status.toUpperCase()}`);
    doc.moveDown(1);
    doc.fontSize(14).font("Helvetica-Bold").text(`Amount Received: ${INR(payment.amount)}`);
    doc.moveDown(2);
    doc.fontSize(8).font("Helvetica").fillColor("#777").text("This is a computer generated receipt.", { align: "center" });
    doc.end();
}
/** Streams a printable/downloadable PDF for a Purchase — mirrors streamBillPdf, direction reversed (Bill To -> Purchased From). */
function streamPurchasePdf(res, purchase) {
    const doc = new pdfkit_1.default({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${purchase.purchase_number}.pdf"`);
    doc.pipe(res);
    doc.fontSize(18).text(purchase.shop?.name || "Shop", { continued: false });
    doc.fontSize(9).fillColor("#555");
    if (purchase.shop?.address)
        doc.text(purchase.shop.address);
    doc.fillColor("#000");
    doc.moveDown(1);
    doc.fontSize(14).text("PURCHASE BILL", { align: "right" });
    doc.fontSize(10);
    doc.text(`Purchase #: ${purchase.purchase_number}`, { align: "right" });
    doc.text(`Date: ${new Date(purchase.purchase_date).toLocaleString("en-IN")}`, { align: "right" });
    doc.text(`Status: ${purchase.status.toUpperCase()}`, { align: "right" });
    doc.moveDown(1);
    doc.fontSize(11).text("Purchased From:");
    doc.fontSize(10);
    doc.text(purchase.supplier?.name || "-");
    if (purchase.supplier?.phone)
        doc.text(purchase.supplier.phone);
    if (purchase.supplier?.address)
        doc.text(purchase.supplier.address);
    doc.moveDown(1);
    const tableTop = doc.y;
    const cols = { name: 40, qty: 240, rate: 290, disc: 350, tax: 410, total: 470 };
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Product", cols.name, tableTop);
    doc.text("Qty", cols.qty, tableTop);
    doc.text("Rate", cols.rate, tableTop);
    doc.text("Disc", cols.disc, tableTop);
    doc.text("Tax", cols.tax, tableTop);
    doc.text("Total", cols.total, tableTop);
    doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).stroke();
    let y = tableTop + 20;
    doc.font("Helvetica");
    for (const item of purchase.items || []) {
        doc.text(item.product_name, cols.name, y, { width: 190 });
        doc.text(String(item.quantity), cols.qty, y);
        doc.text(Number(item.rate).toFixed(2), cols.rate, y);
        doc.text(Number(item.discount_amount).toFixed(2), cols.disc, y);
        doc.text(Number(item.tax_amount).toFixed(2), cols.tax, y);
        doc.text(Number(item.total_amount).toFixed(2), cols.total, y);
        y += 18;
    }
    doc.moveTo(40, y).lineTo(555, y).stroke();
    y += 10;
    const totalsX = 380;
    doc.fontSize(10);
    const line = (label, value, bold = false) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica");
        doc.text(label, totalsX, y, { width: 100 });
        doc.text(value, cols.total, y);
        y += 16;
    };
    line("Subtotal", INR(purchase.subtotal));
    line("Discount", `- ${INR(purchase.discount_amount)}`);
    line("Tax", `+ ${INR(purchase.tax_amount)}`);
    line("Total", INR(purchase.total_amount), true);
    line("Paid", INR(purchase.paid_amount));
    line("Due", INR(purchase.due_amount), true);
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#777").text("This is a computer generated purchase bill.", 40, doc.y, { align: "center" });
    doc.end();
}
//# sourceMappingURL=pdf.js.map