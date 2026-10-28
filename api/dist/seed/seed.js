"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoData = seedDemoData;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("../models");
const seed_1 = require("../utils/seed");
const inventory_1 = require("../utils/inventory");
const ledger_1 = require("../utils/ledger");
const supplierLedger_1 = require("../utils/supplierLedger");
const salaryLedger_1 = require("../utils/salaryLedger");
const invoice_1 = require("../utils/invoice");
const purchaseNumber_1 = require("../utils/purchaseNumber");
const emi_1 = require("../utils/emi");
const seedData_1 = require("./seedData");
function log(msg) {
    console.log(`[DEMO SEED] ${msg}`);
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
const PAYMENT_METHODS_CYCLE = ["cash", "upi", "bank_transfer", "card"];
/**
 * The single idempotency gate for the WHOLE seed: if the demo owner
 * already exists, nothing below ever runs. This is a deliberate
 * all-or-nothing design — the demo dataset is internally consistent
 * (sales reference real customers/products, ledgers are built by the
 * real recordLedgerEntry/recordStockMovement utils, etc.), so partial
 * re-seeding would risk drifting out of sync. Re-running after a
 * partial failure requires `npm run seed:reset` first (see reset.ts).
 */
async function seedDemoData() {
    const existing = await models_1.Owner.findOne({ where: { email: seedData_1.DEMO_MARKER_EMAIL } });
    if (existing) {
        log("Demo owner already exists — skipping (idempotent no-op).");
        return;
    }
    log("Starting...");
    try {
        const owner = await createOwner();
        log("Owner created");
        const shops = await createShops(owner.id);
        log("Shops created");
        const roles = await models_1.Role.findAll({ where: { owner_id: owner.id } });
        const roleByName = new Map(roles.map((r) => [r.name, r]));
        const employees = await createEmployees(owner.id, shops, roleByName);
        log("Employees + roles assigned");
        const { categories, subcategories } = await createCategories(owner.id);
        log("Categories created");
        const suppliers = await createSuppliers(owner.id);
        log("Suppliers created");
        const products = await createProducts(owner.id, shops, categories, subcategories, suppliers, employees[2]);
        log("Products created");
        log("Inventory created (opening stock, above)");
        const customers = await createCustomers(owner.id);
        log("Customers created");
        const salesCount = await createSales(owner.id, shops, customers, products, employees);
        log(`Sales created (${salesCount}) — inventory, ledger and payments updated via real business logic`);
        const emiCount = await createEmiPlans(owner.id, shops, customers, products, employees);
        log(`EMI plans created (${emiCount})`);
        const purchaseCount = await createPurchases(owner.id, shops, suppliers, products, employees);
        log(`Purchases created (${purchaseCount}) — inventory and supplier ledger updated`);
        await createAttendance(owner.id, shops, employees);
        log("Attendance created");
        await createLeave(owner.id, shops, employees);
        log("Leave records created");
        await createPayroll(owner.id, shops, employees);
        log("Payroll created (salary config, advance, incentive, payroll, salary ledger)");
        await createNotifications(owner.id, shops, employees, products);
        log("Notifications created");
        log("Demo seed completed successfully");
    }
    catch (err) {
        log("FAILED");
        console.error(err);
        throw err;
    }
}
async function createOwner() {
    const hashed = await bcryptjs_1.default.hash(seedData_1.DEMO_OWNER.password, 10);
    const owner = await models_1.Owner.create({ name: seedData_1.DEMO_OWNER.name, email: seedData_1.DEMO_OWNER.email, password: hashed });
    await (0, seed_1.seedOwnerDefaults)(owner.id);
    return owner;
}
async function createShops(ownerId) {
    const shops = [];
    for (const s of seedData_1.DEMO_SHOPS) {
        const shop = await models_1.Shop.create({ owner_id: ownerId, name: s.name, code: s.code, address: s.address, phone: s.phone });
        shops.push(shop);
    }
    return shops;
}
async function createEmployees(ownerId, shops, roleByName) {
    const shopByCode = new Map(shops.map((s) => [s.code, s]));
    const employees = [];
    for (const e of seedData_1.DEMO_EMPLOYEES) {
        const hashed = await bcryptjs_1.default.hash(e.password, 10);
        const employee = await models_1.Employee.create({ owner_id: ownerId, name: e.name, email: e.email, password: hashed });
        const role = roleByName.get(e.role);
        if (!role)
            throw new Error(`Demo employee "${e.name}" references unknown role "${e.role}"`);
        for (const code of e.shopCodes) {
            const shop = shopByCode.get(code);
            if (!shop)
                throw new Error(`Demo employee "${e.name}" references unknown shop code "${code}"`);
            await models_1.EmployeeShop.create({ employee_id: employee.id, shop_id: shop.id, role_id: role.id });
        }
        employees.push(employee);
    }
    return employees;
}
async function createCategories(ownerId) {
    const categories = [];
    const subcategories = [];
    for (const c of seedData_1.DEMO_CATEGORIES) {
        const category = await models_1.Category.create({ owner_id: ownerId, name: c.name });
        categories.push(category);
        for (const subName of c.subcategories) {
            const sub = await models_1.Subcategory.create({ owner_id: ownerId, category_id: category.id, name: subName });
            subcategories.push(sub);
        }
    }
    return { categories, subcategories };
}
async function createSuppliers(ownerId) {
    const suppliers = [];
    for (const s of seedData_1.DEMO_SUPPLIERS) {
        suppliers.push(await models_1.Supplier.create({ owner_id: ownerId, name: s.name, phone: s.phone, email: s.email, address: s.address }));
    }
    return suppliers;
}
async function createProducts(ownerId, shops, categories, subcategories, suppliers, inventoryEmployee) {
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    const subByName = new Map(subcategories.map((s) => [s.name, s]));
    const products = [];
    for (const p of seedData_1.DEMO_PRODUCTS) {
        const category = categoryByName.get(p.category);
        const subcategory = p.subcategory ? subByName.get(p.subcategory) : undefined;
        const supplier = suppliers[p.supplierIndex];
        const product = await models_1.Product.create({
            owner_id: ownerId,
            name: p.name,
            sku: p.sku,
            category_id: category?.id ?? null,
            subcategory_id: subcategory?.id ?? null,
            purchase_price: p.purchase,
            selling_price: p.selling,
            mrp: p.mrp,
            discount: 0,
            tax_percent: 0,
            min_stock: p.minStock,
            supplier_id: supplier.id,
        });
        products.push(product);
        for (let i = 0; i < shops.length; i++) {
            const qty = p.stock[i] ?? 0;
            if (qty > 0) {
                await (0, inventory_1.recordStockMovement)({
                    ownerId,
                    shopId: shops[i].id,
                    productId: product.id,
                    type: "opening",
                    quantity: qty,
                    actorType: "employee",
                    actorId: inventoryEmployee.id,
                    notes: "Demo opening stock",
                });
            }
        }
    }
    return products;
}
async function createCustomers(ownerId) {
    const customers = [];
    for (const c of seedData_1.DEMO_CUSTOMERS) {
        customers.push(await models_1.Customer.create({ owner_id: ownerId, name: c.name, phone: c.phone, email: c.email, address: c.address }));
    }
    return customers;
}
/** Mirrors saleController.createSale's core steps directly against the same utils, simplified to 1-2 line items per sale. */
async function createDemoSale(params) {
    const { ownerId, shopId, customerId, actorId, actorType, items, paymentMethod, paidRatio, saleDate } = params;
    return models_1.sequelize.transaction(async (t) => {
        let subtotal = 0;
        const priced = items.map(({ product, quantity }) => {
            const lineTotal = round2(Number(product.selling_price) * quantity);
            subtotal = round2(subtotal + lineTotal);
            return { product, quantity, rate: Number(product.selling_price), lineTotal };
        });
        const totalAmount = subtotal;
        const paidAmount = round2(totalAmount * paidRatio);
        const dueAmount = round2(totalAmount - paidAmount);
        const status = dueAmount <= 0 ? "paid" : paidAmount > 0 ? "partially_paid" : "unpaid";
        const invoiceNumber = await (0, invoice_1.nextInvoiceNumber)({ ownerId, shopId, transaction: t });
        const sale = await models_1.Sale.create({
            owner_id: ownerId,
            shop_id: shopId,
            customer_id: customerId,
            invoice_number: invoiceNumber,
            invoice_date: saleDate,
            subtotal,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            due_amount: dueAmount,
            payment_method: paymentMethod,
            status,
            notes: "Demo data",
            actor_type: actorType,
            actor_id: actorId,
        }, { transaction: t });
        for (const item of priced) {
            await models_1.SaleItem.create({
                sale_id: sale.id,
                product_id: item.product.id,
                product_name: item.product.name,
                sku: item.product.sku,
                quantity: item.quantity,
                rate: item.rate,
                discount_percent: 0,
                discount_amount: 0,
                tax_percent: 0,
                tax_amount: 0,
                total_amount: item.lineTotal,
            }, { transaction: t });
            await (0, inventory_1.recordStockMovement)({
                ownerId,
                shopId,
                productId: item.product.id,
                type: "sale",
                quantity: item.quantity,
                actorType,
                actorId,
                referenceType: "Sale",
                referenceId: sale.id,
                notes: `Demo sale ${invoiceNumber}`,
                externalTransaction: t,
            });
        }
        await (0, ledger_1.recordLedgerEntry)({
            ownerId,
            shopId,
            customerId,
            entryType: "debit",
            amount: totalAmount,
            referenceType: "Sale",
            referenceId: sale.id,
            description: `Sale ${invoiceNumber}`,
            actorType,
            actorId,
            entryDate: saleDate,
            externalTransaction: t,
        });
        if (paidAmount > 0) {
            const payment = await models_1.Payment.create({
                owner_id: ownerId,
                shop_id: shopId,
                customer_id: customerId,
                sale_id: sale.id,
                type: "sale_payment",
                amount: paidAmount,
                method: paymentMethod,
                payment_date: saleDate,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId,
                customerId,
                entryType: "credit",
                amount: paidAmount,
                referenceType: "Payment",
                referenceId: payment.id,
                description: `Payment for ${invoiceNumber}`,
                actorType,
                actorId,
                entryDate: saleDate,
                externalTransaction: t,
            });
        }
        return sale;
    });
}
async function createSales(ownerId, shops, customers, products, employees) {
    const salesStaff = employees[1]; // Demo Sales Staff, assigned to both shops
    let count = 0;
    // 15 demo sales, spread across the last 30 days, alternating shops/customers/products/payment states
    for (let i = 0; i < 15; i++) {
        const shop = shops[i % shops.length];
        const customer = customers[i % customers.length];
        const product = products[i % products.length];
        const secondProduct = products[(i + 3) % products.length];
        const quantity = 1 + (i % 3);
        // Cycle through: fully paid, partially paid, fully on credit
        const paidRatio = [1, 0.5, 0][i % 3];
        await createDemoSale({
            ownerId,
            shopId: shop.id,
            customerId: customer.id,
            actorId: salesStaff.id,
            actorType: "employee",
            items: i % 4 === 0
                ? [{ product, quantity }, { product: secondProduct, quantity: 1 }]
                : [{ product, quantity }],
            paymentMethod: PAYMENT_METHODS_CYCLE[i % PAYMENT_METHODS_CYCLE.length],
            paidRatio,
            saleDate: daysAgo(30 - i * 2),
        });
        count++;
    }
    return count;
}
async function createEmiPlans(ownerId, shops, customers, products, employees) {
    const salesStaff = employees[1];
    const plans = [
        { customer: customers[0], principal: 12000, installments: 6, downPayment: 2000, startDaysAgo: 150 },
        { customer: customers[1], principal: 18000, installments: 9, downPayment: 3000, startDaysAgo: 90 },
    ];
    let count = 0;
    for (const plan of plans) {
        const shop = shops[0];
        const product = products.find((p) => Number(p.selling_price) >= 1000) ?? products[0];
        await models_1.sequelize.transaction(async (t) => {
            const totalAmount = plan.principal;
            const financedAmount = round2(totalAmount - plan.downPayment);
            const invoiceNumber = await (0, invoice_1.nextInvoiceNumber)({ ownerId, shopId: shop.id, transaction: t });
            const sale = await models_1.Sale.create({
                owner_id: ownerId,
                shop_id: shop.id,
                customer_id: plan.customer.id,
                invoice_number: invoiceNumber,
                invoice_date: daysAgo(plan.startDaysAgo),
                subtotal: totalAmount,
                discount_amount: 0,
                tax_amount: 0,
                total_amount: totalAmount,
                paid_amount: plan.downPayment,
                due_amount: financedAmount,
                payment_method: "cash",
                is_emi: true,
                status: "partially_paid",
                notes: "Demo EMI sale",
                actor_type: "employee",
                actor_id: salesStaff.id,
            }, { transaction: t });
            await models_1.SaleItem.create({
                sale_id: sale.id,
                product_id: product.id,
                product_name: product.name,
                sku: product.sku,
                quantity: 1,
                rate: totalAmount,
                discount_percent: 0,
                discount_amount: 0,
                tax_percent: 0,
                tax_amount: 0,
                total_amount: totalAmount,
            }, { transaction: t });
            await (0, inventory_1.recordStockMovement)({
                ownerId,
                shopId: shop.id,
                productId: product.id,
                type: "sale",
                quantity: 1,
                actorType: "employee",
                actorId: salesStaff.id,
                referenceType: "Sale",
                referenceId: sale.id,
                notes: `Demo EMI sale ${invoiceNumber}`,
                externalTransaction: t,
            });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId: shop.id,
                customerId: plan.customer.id,
                entryType: "debit",
                amount: totalAmount,
                referenceType: "Sale",
                referenceId: sale.id,
                description: `EMI Sale ${invoiceNumber}`,
                actorType: "employee",
                actorId: salesStaff.id,
                entryDate: sale.invoice_date,
                externalTransaction: t,
            });
            const downPayment = await models_1.Payment.create({
                owner_id: ownerId,
                shop_id: shop.id,
                customer_id: plan.customer.id,
                sale_id: sale.id,
                type: "down_payment",
                amount: plan.downPayment,
                method: "cash",
                payment_date: sale.invoice_date,
                actor_type: "employee",
                actor_id: salesStaff.id,
            }, { transaction: t });
            await (0, ledger_1.recordLedgerEntry)({
                ownerId,
                shopId: shop.id,
                customerId: plan.customer.id,
                entryType: "credit",
                amount: plan.downPayment,
                referenceType: "Payment",
                referenceId: downPayment.id,
                description: `Down payment for ${invoiceNumber}`,
                actorType: "employee",
                actorId: salesStaff.id,
                externalTransaction: t,
            });
            const schedule = (0, emi_1.buildEmiSchedule)({
                financedAmount,
                interestPercent: 0,
                numberOfInstallments: plan.installments,
                startDate: daysAgo(plan.startDaysAgo),
            });
            const emiPlan = await models_1.EMIPlan.create({
                owner_id: ownerId,
                shop_id: shop.id,
                sale_id: sale.id,
                customer_id: plan.customer.id,
                total_amount: totalAmount,
                down_payment: plan.downPayment,
                financed_amount: financedAmount,
                interest_percent: 0,
                interest_amount: schedule.interestAmount,
                payable_amount: schedule.payableAmount,
                number_of_installments: plan.installments,
                emi_amount: schedule.emiAmount,
                start_date: daysAgo(plan.startDaysAgo),
                late_fee_percent: 2,
                outstanding_amount: schedule.payableAmount,
                actor_type: "employee",
                actor_id: salesStaff.id,
            }, { transaction: t });
            let outstanding = schedule.payableAmount;
            // Pay the first 2 installments in full so the demo shows Paid + Overdue/Due/Upcoming mixed states
            for (const inst of schedule.installments) {
                const isPaid = inst.installmentNumber <= 2;
                const installment = await models_1.EMIInstallment.create({
                    emi_plan_id: emiPlan.id,
                    installment_number: inst.installmentNumber,
                    due_date: inst.dueDate,
                    expected_amount: inst.expectedAmount,
                    paid_amount: isPaid ? inst.expectedAmount : 0,
                    payment_date: isPaid ? inst.dueDate : null,
                    payment_method: isPaid ? "cash" : null,
                    remaining_amount: isPaid ? 0 : inst.expectedAmount,
                    status: isPaid ? "Paid" : "Upcoming", // refreshed lazily on read against real dates elsewhere
                }, { transaction: t });
                if (isPaid) {
                    const instPayment = await models_1.Payment.create({
                        owner_id: ownerId,
                        shop_id: shop.id,
                        customer_id: plan.customer.id,
                        sale_id: sale.id,
                        emi_installment_id: installment.id,
                        type: "emi_payment",
                        amount: inst.expectedAmount,
                        method: "cash",
                        payment_date: inst.dueDate,
                        actor_type: "employee",
                        actor_id: salesStaff.id,
                    }, { transaction: t });
                    await (0, ledger_1.recordLedgerEntry)({
                        ownerId,
                        shopId: shop.id,
                        customerId: plan.customer.id,
                        entryType: "credit",
                        amount: inst.expectedAmount,
                        referenceType: "EMIInstallment",
                        referenceId: installment.id,
                        description: `EMI installment #${inst.installmentNumber} for ${invoiceNumber}`,
                        actorType: "employee",
                        actorId: salesStaff.id,
                        entryDate: inst.dueDate,
                        externalTransaction: t,
                    });
                    outstanding = round2(outstanding - inst.expectedAmount);
                }
            }
            emiPlan.outstanding_amount = outstanding;
            await emiPlan.save({ transaction: t });
            sale.paid_amount = round2(Number(plan.downPayment) + (schedule.payableAmount - outstanding));
            sale.due_amount = outstanding;
            sale.status = outstanding <= 0 ? "paid" : "partially_paid";
            await sale.save({ transaction: t });
        });
        count++;
    }
    return count;
}
async function createDemoPurchase(params) {
    const { ownerId, shopId, supplierId, actorId, actorType, items, paymentMethod, paidRatio, purchaseDate } = params;
    return models_1.sequelize.transaction(async (t) => {
        let subtotal = 0;
        const priced = items.map(({ product, quantity }) => {
            const lineTotal = round2(Number(product.purchase_price) * quantity);
            subtotal = round2(subtotal + lineTotal);
            return { product, quantity, rate: Number(product.purchase_price), lineTotal };
        });
        const totalAmount = subtotal;
        const paidAmount = round2(totalAmount * paidRatio);
        const dueAmount = round2(totalAmount - paidAmount);
        const status = dueAmount <= 0 ? "paid" : paidAmount > 0 ? "partially_paid" : "unpaid";
        const purchaseNumber = await (0, purchaseNumber_1.nextPurchaseNumber)({ ownerId, shopId, transaction: t });
        const purchase = await models_1.Purchase.create({
            owner_id: ownerId,
            shop_id: shopId,
            supplier_id: supplierId,
            purchase_number: purchaseNumber,
            purchase_date: purchaseDate,
            subtotal,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            due_amount: dueAmount,
            payment_method: paymentMethod,
            status,
            notes: "Demo data",
            actor_type: actorType,
            actor_id: actorId,
        }, { transaction: t });
        for (const item of priced) {
            await models_1.PurchaseItem.create({
                purchase_id: purchase.id,
                product_id: item.product.id,
                product_name: item.product.name,
                sku: item.product.sku,
                quantity: item.quantity,
                rate: item.rate,
                discount_percent: 0,
                discount_amount: 0,
                tax_percent: 0,
                tax_amount: 0,
                total_amount: item.lineTotal,
            }, { transaction: t });
            await (0, inventory_1.recordStockMovement)({
                ownerId,
                shopId,
                productId: item.product.id,
                type: "purchase",
                quantity: item.quantity,
                actorType,
                actorId,
                referenceType: "Purchase",
                referenceId: purchase.id,
                notes: `Demo purchase ${purchaseNumber}`,
                externalTransaction: t,
            });
        }
        await (0, supplierLedger_1.recordSupplierLedgerEntry)({
            ownerId,
            shopId,
            supplierId,
            entryType: "credit",
            amount: totalAmount,
            referenceType: "Purchase",
            referenceId: purchase.id,
            description: `Purchase ${purchaseNumber}`,
            actorType,
            actorId,
            entryDate: purchaseDate,
            externalTransaction: t,
        });
        if (paidAmount > 0) {
            const payment = await models_1.SupplierPayment.create({
                owner_id: ownerId,
                shop_id: shopId,
                supplier_id: supplierId,
                purchase_id: purchase.id,
                type: "purchase_payment",
                amount: paidAmount,
                method: paymentMethod,
                payment_date: purchaseDate,
                actor_type: actorType,
                actor_id: actorId,
            }, { transaction: t });
            await (0, supplierLedger_1.recordSupplierLedgerEntry)({
                ownerId,
                shopId,
                supplierId,
                entryType: "debit",
                amount: paidAmount,
                referenceType: "SupplierPayment",
                referenceId: payment.id,
                description: `Payment for ${purchaseNumber}`,
                actorType,
                actorId,
                externalTransaction: t,
            });
        }
        return purchase;
    });
}
async function createPurchases(ownerId, shops, suppliers, products, employees) {
    const inventoryStaff = employees[2];
    let count = 0;
    for (let i = 0; i < 7; i++) {
        const shop = shops[i % shops.length];
        const supplier = suppliers[i % suppliers.length];
        const product = products[(i * 2) % products.length];
        const secondProduct = products[(i * 2 + 1) % products.length];
        const paidRatio = [1, 0.5, 0][i % 3];
        await createDemoPurchase({
            ownerId,
            shopId: shop.id,
            supplierId: supplier.id,
            actorId: inventoryStaff.id,
            actorType: "employee",
            items: [
                { product, quantity: 10 + i },
                { product: secondProduct, quantity: 5 },
            ],
            paymentMethod: PAYMENT_METHODS_CYCLE[i % PAYMENT_METHODS_CYCLE.length],
            paidRatio,
            purchaseDate: daysAgo(45 - i * 3),
        });
        count++;
    }
    return count;
}
async function createAttendance(ownerId, shops, employees) {
    const statusCycle = ["Present", "Present", "Present", "Present", "Late", "Half Day", "Absent", "Week Off"];
    for (const employee of employees) {
        const assignment = await models_1.EmployeeShop.findOne({ where: { employee_id: employee.id } });
        if (!assignment)
            continue;
        for (let d = 20; d >= 1; d--) {
            const date = daysAgo(d);
            const dateStr = date.toISOString().slice(0, 10);
            const status = statusCycle[d % statusCycle.length];
            const checkIn = status === "Present" || status === "Late" || status === "Half Day" ? new Date(date.setHours(9, status === "Late" ? 45 : 0, 0, 0)) : null;
            const checkOut = checkIn ? new Date(date.setHours(status === "Half Day" ? 13 : 18, 0, 0, 0)) : null;
            const workingHours = checkIn && checkOut ? round2((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) : 0;
            await models_1.Attendance.create({
                owner_id: ownerId,
                shop_id: assignment.shop_id,
                employee_id: employee.id,
                date: dateStr,
                check_in: checkIn,
                check_out: checkOut,
                working_hours: workingHours,
                status,
                marked_by_actor_type: "employee",
                marked_by_actor_id: employee.id,
            });
        }
    }
}
async function createLeave(ownerId, shops, employees) {
    const statuses = ["Approved", "Pending", "Rejected"];
    for (let i = 0; i < employees.length; i++) {
        const employee = employees[i];
        const assignment = await models_1.EmployeeShop.findOne({ where: { employee_id: employee.id } });
        if (!assignment)
            continue;
        const status = statuses[i % statuses.length];
        const start = daysAgo(10 - i * 2);
        const end = daysAgo(9 - i * 2);
        await models_1.LeaveRequest.create({
            owner_id: ownerId,
            shop_id: assignment.shop_id,
            employee_id: employee.id,
            leave_type: i % 2 === 0 ? "Casual" : "Sick",
            start_date: start.toISOString().slice(0, 10),
            end_date: end.toISOString().slice(0, 10),
            days: 2,
            reason: "Demo leave request",
            is_paid: status === "Approved",
            status,
            approved_by_actor_type: status === "Pending" ? null : "owner",
            approved_by_actor_id: status === "Pending" ? null : ownerId,
            decided_at: status === "Pending" ? null : new Date(),
        });
    }
}
async function createPayroll(ownerId, shops, employees) {
    const periodStart = "2026-01-01";
    const periodEnd = "2026-01-31";
    for (const employee of employees) {
        const assignment = await models_1.EmployeeShop.findOne({ where: { employee_id: employee.id } });
        if (!assignment)
            continue;
        const basicSalary = 20000 + employees.indexOf(employee) * 5000;
        await models_1.SalaryConfig.create({
            owner_id: ownerId,
            employee_id: employee.id,
            salary_type: "monthly",
            basic_salary: basicSalary,
            allowances: 2000,
            overtime_rate: 100,
            incentive: 0,
            commission_percent: 0,
            deductions: 0,
            salary_cycle: "monthly",
            effective_date: "2025-12-01",
        });
        // A small advance, partially recovered, for the first employee only (keeps the demo focused)
        if (employees.indexOf(employee) === 0) {
            await models_1.sequelize.transaction(async (t) => {
                const advance = await models_1.EmployeeAdvance.create({
                    owner_id: ownerId,
                    shop_id: assignment.shop_id,
                    employee_id: employee.id,
                    amount: 5000,
                    outstanding_amount: 2500,
                    date: daysAgo(25),
                    reason: "Demo advance",
                    method: "cash",
                    status: "partially_recovered",
                    actor_type: "owner",
                    actor_id: ownerId,
                }, { transaction: t });
                await (0, salaryLedger_1.recordEmployeeLedgerEntry)({
                    ownerId,
                    shopId: assignment.shop_id,
                    employeeId: employee.id,
                    entryType: "debit",
                    amount: 5000,
                    referenceType: "Advance",
                    referenceId: advance.id,
                    description: "Demo salary advance disbursed",
                    actorType: "owner",
                    actorId: ownerId,
                    entryDate: daysAgo(25),
                    externalTransaction: t,
                });
            });
        }
        // Finalized payroll for Jan 2026, partially paid — post the real ledger entries
        const grossSalary = round2(basicSalary + 2000);
        const advanceDeduction = employees.indexOf(employee) === 0 ? 2500 : 0;
        const netSalary = round2(grossSalary - advanceDeduction);
        const paidAmount = round2(netSalary * 0.6);
        await models_1.sequelize.transaction(async (t) => {
            const payroll = await models_1.Payroll.create({
                owner_id: ownerId,
                shop_id: assignment.shop_id,
                employee_id: employee.id,
                period_start: periodStart,
                period_end: periodEnd,
                salary_type: "monthly",
                present_days: 26,
                absent_days: 1,
                half_days: 1,
                paid_leave_days: 1,
                unpaid_leave_days: 0,
                holiday_days: 1,
                week_off_days: 4,
                payable_days: 31,
                total_days: 31,
                overtime_hours: 0,
                overtime_amount: 0,
                basic_salary: basicSalary,
                allowances: 2000,
                incentive_amount: 0,
                gross_salary: grossSalary,
                other_deduction: 0,
                advance_deduction: advanceDeduction,
                net_salary: netSalary,
                paid_amount: paidAmount,
                due_amount: round2(netSalary - paidAmount),
                status: "partially_paid",
                notes: "Demo payroll",
                actor_type: "owner",
                actor_id: ownerId,
            }, { transaction: t });
            await (0, salaryLedger_1.recordEmployeeLedgerEntry)({
                ownerId,
                shopId: assignment.shop_id,
                employeeId: employee.id,
                entryType: "credit",
                amount: grossSalary,
                referenceType: "Salary",
                referenceId: payroll.id,
                description: `Demo salary for ${periodStart} to ${periodEnd}`,
                actorType: "owner",
                actorId: ownerId,
                externalTransaction: t,
            });
            if (advanceDeduction > 0) {
                await (0, salaryLedger_1.recordEmployeeLedgerEntry)({
                    ownerId,
                    shopId: assignment.shop_id,
                    employeeId: employee.id,
                    entryType: "debit",
                    amount: advanceDeduction,
                    referenceType: "AdvanceRecovery",
                    referenceId: payroll.id,
                    description: `Demo advance recovery for ${periodStart} to ${periodEnd}`,
                    actorType: "owner",
                    actorId: ownerId,
                    externalTransaction: t,
                });
            }
            await (0, salaryLedger_1.recordEmployeeLedgerEntry)({
                ownerId,
                shopId: assignment.shop_id,
                employeeId: employee.id,
                entryType: "debit",
                amount: paidAmount,
                referenceType: "SalaryPayment",
                referenceId: payroll.id,
                description: `Demo salary payment for ${periodStart} to ${periodEnd}`,
                actorType: "owner",
                actorId: ownerId,
                externalTransaction: t,
            });
        });
    }
    // One incentive example, unconsumed (pending), for the sales staff member
    const salesStaff = employees[1];
    const assignment = await models_1.EmployeeShop.findOne({ where: { employee_id: salesStaff.id } });
    if (assignment) {
        await models_1.EmployeeIncentive.create({
            owner_id: ownerId,
            shop_id: assignment.shop_id,
            employee_id: salesStaff.id,
            type: "percentage",
            basis: "sales",
            base_amount: 50000,
            percent: 2,
            amount: 0,
            computed_amount: 1000,
            period_start: "2026-02-01",
            period_end: "2026-02-28",
            description: "Demo 2% sales commission",
            actor_type: "owner",
            actor_id: ownerId,
        });
    }
}
async function createNotifications(ownerId, shops, employees, products) {
    // Low stock: 20000mAh Power Bank has branch-store stock (5) below its min_stock (8) by design — see seedData.ts
    const lowStockProduct = products.find((p) => p.sku === "NSYU-PWR-020K");
    if (lowStockProduct) {
        await models_1.Notification.create({
            owner_id: ownerId,
            shop_id: shops[1]?.id ?? null,
            recipient_type: "owner",
            recipient_id: ownerId,
            type: "low_stock",
            title: "Low stock alert",
            message: `${lowStockProduct.name} is low on stock at ${shops[1]?.name ?? "a shop"} (5 left, min 8)`,
            reference_type: "Product",
            reference_id: lowStockProduct.id,
        });
    }
    await models_1.Notification.create({
        owner_id: ownerId,
        recipient_type: "owner",
        recipient_id: ownerId,
        type: "emi_overdue",
        title: "EMI installment overdue",
        message: "A customer has an overdue EMI installment — see EMI reports for details.",
    });
    const manager = employees[0];
    const managerAssignment = await models_1.EmployeeShop.findOne({ where: { employee_id: manager.id } });
    await models_1.Notification.create({
        owner_id: ownerId,
        shop_id: managerAssignment?.shop_id ?? null,
        recipient_type: "owner",
        recipient_id: ownerId,
        type: "leave_requested",
        title: "Leave request pending",
        message: "A demo employee has a leave request awaiting your decision.",
    });
    await models_1.Notification.create({
        owner_id: ownerId,
        recipient_type: "owner",
        recipient_id: ownerId,
        type: "general",
        title: "Payment reminder",
        message: "Several customers have outstanding balances — check Customer Ledger for details.",
    });
}
//# sourceMappingURL=seed.js.map