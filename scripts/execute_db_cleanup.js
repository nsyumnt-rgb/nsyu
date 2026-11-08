// scripts/execute_db_cleanup.js
// NSYU Database Cleanup Execution Script

const path = require('path');
const { Client } = require(path.resolve('api/node_modules/pg'));

const config = {
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lggjtxzannywecuvwqbl',
  password: 'Nsyu@8800503662',
  ssl: { rejectUnauthorized: false }
};

async function runCleanup() {
  console.log('====================================================');
  console.log('NSYU Database Cleanup Execution');
  console.log('Database Host: ' + config.host);
  console.log('Database Name: ' + config.database);
  console.log('====================================================\n');

  const client = new Client(config);
  await client.connect();
  console.log('✔ Connected to Supabase PostgreSQL database.\n');

  try {
    console.log('Starting atomic transaction (BEGIN)...');
    await client.query('BEGIN');

    // 1. Clean product stocks (delete 183 dummy stocks, keep product 1)
    console.log('1. Cleaning product_stocks table...');
    const delStocksRes = await client.query('DELETE FROM product_stocks WHERE product_id != 1');
    console.log(`   ✔ Deleted ${delStocksRes.rowCount} dummy product_stocks records (kept product_id = 1).`);

    // 2. Clean products (delete 185 dummy/test products, keep product 1)
    console.log('2. Cleaning products table...');
    const delProductsRes = await client.query('DELETE FROM products WHERE id != 1');
    console.log(`   ✔ Deleted ${delProductsRes.rowCount} dummy products (kept id = 1).`);

    // 3. Clean categories (delete categories 2 to 7, keep category 1 'CHARGER')
    console.log('3. Cleaning categories table...');
    const delCategoriesRes = await client.query('DELETE FROM categories WHERE id != 1');
    console.log(`   ✔ Deleted ${delCategoriesRes.rowCount} categories (kept id = 1 'CHARGER').`);

    // 4. Clean test audit logs (delete test product logs 2-9, keep setup #1 and customer #10)
    console.log('4. Cleaning audit_logs table...');
    const delAuditRes = await client.query('DELETE FROM audit_logs WHERE id IN (2, 3, 4, 5, 6, 7, 8, 9)');
    console.log(`   ✔ Deleted ${delAuditRes.rowCount} test audit logs (kept real setup logs).`);

    // 5. Clean old refresh tokens, keeping the latest active token
    console.log('5. Cleaning stale refresh_tokens...');
    const delTokensRes = await client.query(`
      DELETE FROM refresh_tokens 
      WHERE id NOT IN (
        SELECT id FROM refresh_tokens ORDER BY id DESC LIMIT 1
      )
    `);
    console.log(`   ✔ Deleted ${delTokensRes.rowCount} old refresh tokens (kept latest active session).`);

    // 6. Verify Post-Cleanup State and Relational Integrity
    console.log('\n--- Verifying Post-Cleanup Relational Integrity ---');

    // Check Product 1
    const p1Res = await client.query(`
      SELECT p.id, p.name, p.sku, p.category_id, c.name AS category_name, 
             p.supplier_id, s.name AS supplier_name, ps.current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.shop_id = 1
      WHERE p.id = 1
    `);
    const p1 = p1Res.rows[0];
    if (!p1) throw new Error('Product 1 was not found!');
    if (!p1.category_name) throw new Error('Product 1 category relationship is broken!');
    if (!p1.supplier_name) throw new Error('Product 1 supplier relationship is broken!');
    if (p1.current_stock === null || p1.current_stock === undefined) {
      throw new Error('Product 1 stock record is missing in Shop 1!');
    }
    console.log('✔ Retained Product verified:');
    console.log(`   ID: ${p1.id} | Name: "${p1.name}" | SKU: ${p1.sku}`);
    console.log(`   Category: "${p1.category_name}" (ID: ${p1.category_id})`);
    console.log(`   Supplier: "${p1.supplier_name}" (ID: ${p1.supplier_id})`);
    console.log(`   Shop 1 Stock: ${p1.current_stock} units`);

    // Check Customer 1
    const custRes = await client.query('SELECT id, name, phone, email, owner_id FROM customers WHERE id = 1');
    const cust1 = custRes.rows[0];
    if (!cust1) throw new Error('Customer 1 was not found!');
    console.log(`✔ Retained Customer: ID: ${cust1.id} | Name: "${cust1.name}" | Phone: ${cust1.phone}`);

    // Check Supplier 1
    const suppRes = await client.query('SELECT id, name, phone, email, reference_code FROM suppliers WHERE id = 1');
    const supp1 = suppRes.rows[0];
    if (!supp1) throw new Error('Supplier 1 was not found!');
    console.log(`✔ Retained Supplier: ID: ${supp1.id} | Name: "${supp1.name}" | Ref: ${supp1.reference_code}`);

    // Check Owner and Shop 1
    const ownerRes = await client.query('SELECT id, name, email FROM owners WHERE id = 1');
    const shopRes = await client.query('SELECT id, name, code FROM shops WHERE id = 1');
    console.log(`✔ Retained Owner: ID: ${ownerRes.rows[0]?.id} | Name: "${ownerRes.rows[0]?.name}"`);
    console.log(`✔ Retained Shop: ID: ${shopRes.rows[0]?.id} | Name: "${shopRes.rows[0]?.name}" (${shopRes.rows[0]?.code})`);

    // Table Counts Verification
    const countQueries = [
      ['products', 1],
      ['product_stocks', 1],
      ['categories', 1],
      ['suppliers', 1],
      ['customers', 1],
      ['owners', 1],
      ['shops', 1],
      ['shop_portal_settings', 1],
      ['roles', 18],
      ['role_permissions', 448],
      ['role_field_permissions', 112],
      ['reference_counters', 2],
      ['audit_logs', 2],
      ['refresh_tokens', 1]
    ];

    console.log('\n--- Verifying Row Counts Against Target ---');
    for (const [tbl, expected] of countQueries) {
      const cntRes = await client.query(`SELECT COUNT(*) AS total FROM "${tbl}"`);
      const actual = parseInt(cntRes.rows[0].total, 10);
      if (actual !== expected) {
        throw new Error(`Count mismatch on table "${tbl}": expected ${expected}, got ${actual}`);
      }
      console.log(`   ✔ [${tbl}]: ${actual} row(s) (Matches expected ${expected})`);
    }

    // Verify all transaction tables remain at 0 rows
    const zeroTables = [
      'purchases', 'purchase_items', 'sales', 'sale_items', 'payments', 
      'supplier_payments', 'customer_ledger', 'supplier_ledger', 
      'inventory_transactions', 'stock_transfers', 'orders', 'order_items', 
      'customer_carts', 'customer_cart_items', 'attendance', 'leave_requests', 
      'payrolls', 'notifications'
    ];
    for (const tbl of zeroTables) {
      const cntRes = await client.query(`SELECT COUNT(*) AS total FROM "${tbl}"`);
      const actual = parseInt(cntRes.rows[0].total, 10);
      if (actual !== 0) {
        throw new Error(`Table "${tbl}" was expected to be 0 rows, but has ${actual}!`);
      }
    }
    console.log('✔ All 18 transaction, inventory, and portal tables verified at 0 rows.');

    // Commit Transaction
    console.log('\nCommitting atomic transaction (COMMIT)...');
    await client.query('COMMIT');
    console.log('✔ TRANSACTION COMMITTED SUCCESSFULLY.');

    console.log('\n====================================================');
    console.log('DATABASE CLEANUP COMPLETED AND FULLY VERIFIED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Error during cleanup, rolling back transaction:', err);
    await client.query('ROLLBACK');
    console.log('✔ Transaction rolled back safely. Database untouched.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runCleanup();

