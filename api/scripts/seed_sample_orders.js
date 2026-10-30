const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME || 'postgres', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

const ORDERS_FIXTURES = [
  {
    order_number: 'ORD-001248',
    date: new Date('2026-10-29T10:45:00Z'),
    customer: { name: 'Rajesh Kumar', phone: '+91 98765 43210', email: 'rajesh@gmail.com', address: '123, MG Road, New Delhi' },
    items: [
      { product_name: 'Laptop HP 15s', sku: 'LP-001', quantity: 1, rate: 8000, gst_percent: 18, discount_percent: 0, amount: 8000 },
      { product_name: 'Wireless Mouse', sku: 'MS-002', quantity: 1, rate: 850, gst_percent: 18, discount_percent: 10, amount: 765 },
      { product_name: 'Mechanical Keyboard', sku: 'KB-003', quantity: 1, rate: 1500, gst_percent: 18, discount_percent: 0, amount: 1500 }
    ],
    subtotal: 10350,
    discount_amount: 500,
    tax_amount: 2600,
    total_amount: 12450,
    payment_method: 'Cash',
    payment_status: 'Paid',
    status: 'Delivered',
    order_type: 'Walk-in',
    remarks: 'Delivered with invoice signed.'
  },
  {
    order_number: 'ORD-001247',
    date: new Date('2026-10-28T16:20:00Z'),
    customer: { name: 'Amit Sharma', phone: '+91 98765 67890', email: 'amit@gmail.com', address: 'Shop 4B, Nehru Place, Delhi' },
    items: [
      { product_name: 'ERD Fast Charger 20W', sku: 'CH-001', quantity: 10, rate: 450, gst_percent: 18, discount_percent: 5, amount: 4275 },
      { product_name: 'Type-C Braided Cable', sku: 'CB-004', quantity: 20, rate: 210, gst_percent: 18, discount_percent: 5, amount: 3955 }
    ],
    subtotal: 8230,
    discount_amount: 200,
    tax_amount: 200,
    total_amount: 8230,
    payment_method: 'Online',
    payment_status: 'Pending',
    status: 'Processing',
    order_type: 'Online',
    remarks: 'Order verified, pending payment confirmation.'
  },
  {
    order_number: 'ORD-001246',
    date: new Date('2026-10-28T11:15:00Z'),
    customer: { name: 'Sneha Verma', phone: '+91 91234 56789', email: 'sneha@gmail.com', address: 'Plot 12, Sector 18, Noida' },
    items: [
      { product_name: 'Bluetooth Headphones', sku: 'HP-005', quantity: 2, rate: 2500, gst_percent: 18, discount_percent: 0, amount: 5000 },
      { product_name: 'Protective Case', sku: 'CS-006', quantity: 2, rate: 495, gst_percent: 18, discount_percent: 0, amount: 990 }
    ],
    subtotal: 5990,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 5990,
    payment_method: 'Online',
    payment_status: 'Paid',
    status: 'Shipped',
    order_type: 'Online',
    remarks: 'Shipped via BlueDart AWB# 8847291.'
  },
  {
    order_number: 'ORD-001245',
    date: new Date('2026-10-27T15:40:00Z'),
    customer: { name: 'Mohd Ali', phone: '+91 99887 66554', email: 'ali@gmail.com', address: 'Main Bazar, Old Delhi' },
    items: [
      { product_name: 'Smart Display Hub', sku: 'SD-007', quantity: 1, rate: 18500, gst_percent: 18, discount_percent: 0, amount: 18500 }
    ],
    subtotal: 18500,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 18500,
    payment_method: 'Cash',
    payment_status: 'Paid',
    status: 'Delivered',
    order_type: 'Walk-in',
    remarks: 'Customer picked up from store.'
  },
  {
    order_number: 'ORD-001244',
    date: new Date('2026-10-27T12:10:00Z'),
    customer: { name: 'Pooja Singh', phone: '+91 98712 34567', email: 'pooja@gmail.com', address: 'B-44, Lajpat Nagar, New Delhi' },
    items: [
      { product_name: 'LED Monitor 24-inch', sku: 'MN-008', quantity: 1, rate: 12000, gst_percent: 18, discount_percent: 0, amount: 12000 },
      { product_name: 'External SSD 1TB', sku: 'SSD-009', quantity: 1, rate: 7500, gst_percent: 18, discount_percent: 0, amount: 7500 },
      { product_name: 'HDMI Cable 3m', sku: 'HD-010', quantity: 2, rate: 900, gst_percent: 18, discount_percent: 0, amount: 1800 }
    ],
    subtotal: 21300,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 21300,
    payment_method: 'Online',
    payment_status: 'Failed',
    status: 'Cancelled',
    order_type: 'Online',
    remarks: 'Payment gateway timeout. Customer cancelled.'
  },
  {
    order_number: 'ORD-001243',
    date: new Date('2026-10-26T09:25:00Z'),
    customer: { name: 'Vikram Patel', phone: '+91 95555 44433', email: 'vikram@gmail.com', address: 'Chandni Chowk, Delhi' },
    items: [
      { product_name: 'Thermal Receipt Printer', sku: 'PR-011', quantity: 1, rate: 7800, gst_percent: 18, discount_percent: 0, amount: 7800 }
    ],
    subtotal: 7800,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 7800,
    payment_method: 'Card',
    payment_status: 'Paid',
    status: 'Processing',
    order_type: 'Walk-in',
    remarks: 'Printer firmware configured, packaging in progress.'
  },
  {
    order_number: 'ORD-001242',
    date: new Date('2026-10-25T18:30:00Z'),
    customer: { name: 'Kavita Yadav', phone: '+91 96666 77788', email: 'kavita@gmail.com', address: 'Sector 62, Noida' },
    items: [
      { product_name: 'Earbuds Pro', sku: 'EB-012', quantity: 2, rate: 3500, gst_percent: 18, discount_percent: 0, amount: 7000 },
      { product_name: 'Power Bank 20000mAh', sku: 'PB-013', quantity: 2, rate: 2500, gst_percent: 18, discount_percent: 0, amount: 5000 },
      { product_name: 'Desk Stand', sku: 'DS-014', quantity: 3, rate: 996, gst_percent: 18, discount_percent: 0, amount: 2990 }
    ],
    subtotal: 14990,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 14990,
    payment_method: 'Cash',
    payment_status: 'Pending',
    status: 'Pending',
    order_type: 'Walk-in',
    remarks: 'Awaiting cash on delivery collection.'
  },
  {
    order_number: 'ORD-001241',
    date: new Date('2026-10-24T14:15:00Z'),
    customer: { name: 'Arjun Mehta', phone: '+91 98888 33322', email: 'arjun@gmail.com', address: 'Model Town, Delhi' },
    items: [
      { product_name: 'Smart Watch Series 7', sku: 'SW-015', quantity: 1, rate: 6950, gst_percent: 18, discount_percent: 0, amount: 6950 },
      { product_name: 'Extra Straps (Set of 3)', sku: 'ST-016', quantity: 1, rate: 2500, gst_percent: 18, discount_percent: 0, amount: 2500 }
    ],
    subtotal: 9450,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 9450,
    payment_method: 'Online',
    payment_status: 'Paid',
    status: 'Shipped',
    order_type: 'Online',
    remarks: 'In transit via Delhivery.'
  }
];

async function seed() {
  await sequelize.authenticate();
  console.log('Connected to DB!');

  const [[owner]] = await sequelize.query('SELECT id FROM owners LIMIT 1');
  const [[shop]] = await sequelize.query('SELECT id FROM shops WHERE owner_id = :owner_id LIMIT 1', { replacements: { owner_id: owner.id } });

  const ownerId = owner.id;
  const shopId = shop ? shop.id : 1;

  for (const f of ORDERS_FIXTURES) {
    // 1. Customer
    const [existingCust] = await sequelize.query(
      'SELECT id FROM customers WHERE owner_id = :owner_id AND (phone = :phone OR name = :name)',
      { replacements: { owner_id: ownerId, phone: f.customer.phone, name: f.customer.name } }
    );
    let customerId;
    if (existingCust.length > 0) {
      customerId = existingCust[0].id;
    } else {
      const [[created]] = await sequelize.query(
        `INSERT INTO customers (owner_id, name, phone, address, created_at, updated_at)
         VALUES (:owner_id, :name, :phone, :address, NOW(), NOW()) RETURNING id`,
        { replacements: { owner_id: ownerId, ...f.customer } }
      );
      customerId = created.id;
    }

    // 2. Order
    const [existingOrder] = await sequelize.query(
      'SELECT id FROM orders WHERE owner_id = :owner_id AND order_number = :order_number',
      { replacements: { owner_id: ownerId, order_number: f.order_number } }
    );

    let orderId;
    if (existingOrder.length > 0) {
      orderId = existingOrder[0].id;
      await sequelize.query(
        `UPDATE orders SET
          order_date = :date, subtotal = :subtotal, discount_amount = :discount_amount,
          tax_amount = :tax_amount, total_amount = :total_amount, status = :status,
          order_type = :order_type, payment_method = :payment_method, payment_status = :payment_status,
          remarks = :remarks, shipping_address = :shipping_address, updated_at = NOW()
         WHERE id = :id`,
        {
          replacements: {
            id: orderId,
            date: f.date,
            subtotal: f.subtotal,
            discount_amount: f.discount_amount,
            tax_amount: f.tax_amount,
            total_amount: f.total_amount,
            status: f.status,
            order_type: f.order_type,
            payment_method: f.payment_method,
            payment_status: f.payment_status,
            remarks: f.remarks,
            shipping_address: f.customer.address
          }
        }
      );
    } else {
      const [[createdOrder]] = await sequelize.query(
        `INSERT INTO orders (
          owner_id, shop_id, customer_id, order_number, order_date, subtotal,
          discount_amount, tax_amount, total_amount, status, order_type,
          payment_method, payment_status, remarks, shipping_address, created_at, updated_at
        ) VALUES (
          :owner_id, :shop_id, :customer_id, :order_number, :date, :subtotal,
          :discount_amount, :tax_amount, :total_amount, :status, :order_type,
          :payment_method, :payment_status, :remarks, :shipping_address, NOW(), NOW()
        ) RETURNING id`,
        {
          replacements: {
            owner_id: ownerId,
            shop_id: shopId,
            customer_id: customerId,
            order_number: f.order_number,
            date: f.date,
            subtotal: f.subtotal,
            discount_amount: f.discount_amount,
            tax_amount: f.tax_amount,
            total_amount: f.total_amount,
            status: f.status,
            order_type: f.order_type,
            payment_method: f.payment_method,
            payment_status: f.payment_status,
            remarks: f.remarks,
            shipping_address: f.customer.address
          }
        }
      );
      orderId = createdOrder.id;
    }

    // 3. Items
    await sequelize.query('DELETE FROM order_items WHERE order_id = :order_id', { replacements: { order_id: orderId } });
    for (const item of f.items) {
      await sequelize.query(
        `INSERT INTO order_items (
          order_id, product_name, sku, available_stock, quantity, rate, discount_percent, gst_percent, amount, created_at, updated_at
        ) VALUES (
          :order_id, :product_name, :sku, 25, :quantity, :rate, :discount_percent, :gst_percent, :amount, NOW(), NOW()
        )`,
        { replacements: { order_id: orderId, ...item } }
      );
    }
  }

  console.log('Seeded 8 realistic orders matching reference images successfully!');
  await sequelize.close();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});

