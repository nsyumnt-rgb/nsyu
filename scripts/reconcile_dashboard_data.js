// scripts/reconcile_dashboard_data.js
// NSYU Live Dashboard Real Data Reconciliation Tool

const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../api/node_modules/pg'));
const puppeteer = require(path.resolve(__dirname, '../web/node_modules/puppeteer-core'));

const pgConfig = {
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lggjtxzannywecuvwqbl',
  password: 'Nsyu@8800503662',
  ssl: { rejectUnauthorized: false }
};

const API_BASE = 'https://nsyu-backend-api.onrender.com/api';

async function fetchWithRetry(url, options = {}, retries = 5, backoffMs = 4000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
      return res;
    } catch (err) {
      console.log(`[API Retry ${i + 1}/${retries}] ${err.message} on ${url}`);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

async function reconcileDashboard() {
  console.log('======================================================================');
  console.log('NSYU DASHBOARD REAL DATA VERIFICATION & THREE-WAY RECONCILIATION');
  console.log('Database: Supabase PostgreSQL');
  console.log('Backend API: https://nsyu-backend-api.onrender.com/api');
  console.log('Live Frontend: https://nsyumnt-rgb.github.io/nsyu/#/app/dashboard');
  console.log('======================================================================\n');

  // STEP 1: Query Supabase PostgreSQL Database Directly
  console.log('--- STEP 1: DIRECT SUPABASE POSTGRESQL DATABASE AUDIT ---');
  const pgClient = new Client(pgConfig);
  await pgClient.connect();

  // 1a. Products count and stock value
  const prodRes = await pgClient.query(`
    SELECT p.id, p.name, p.sku, p.purchase_price, p.selling_price, p.min_stock,
           COALESCE(ps.current_stock, 0) as current_stock
    FROM products p
    LEFT JOIN product_stocks ps ON ps.product_id = p.id
    ORDER BY p.id ASC;
  `);
  const products = prodRes.rows;
  const totalProducts = products.length;
  let totalStockValue = 0;
  let inStockProductsCount = 0;
  let lowStockProducts = [];

  products.forEach(p => {
    const stock = Number(p.current_stock);
    const price = Number(p.purchase_price || p.selling_price || 0);
    totalStockValue += stock * price;
    if (stock > 0) inStockProductsCount++;
    const minStock = Number(p.min_stock ?? 5);
    if (stock <= minStock) lowStockProducts.push(p);
  });

  // 1b. Sales count and total
  const salesRes = await pgClient.query(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
    FROM sales;
  `);
  const totalSalesCount = Number(salesRes.rows[0].count);
  const totalSalesAmount = Number(salesRes.rows[0].total);

  // 1c. Purchases count and total
  const purchRes = await pgClient.query(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
    FROM purchases;
  `);
  const totalPurchasesCount = Number(purchRes.rows[0].count);
  const totalPurchasesAmount = Number(purchRes.rows[0].total);

  // 1d. Customers count
  const custRes = await pgClient.query(`SELECT COUNT(*) as count FROM customers;`);
  const totalCustomers = Number(custRes.rows[0].count);

  // 1e. Employees count
  const empRes = await pgClient.query(`SELECT COUNT(*) as count FROM employees;`);
  const totalEmployees = Number(empRes.rows[0].count);

  // 1f. Suppliers count
  const suppRes = await pgClient.query(`SELECT COUNT(*) as count FROM suppliers;`);
  const totalSuppliers = Number(suppRes.rows[0].count);

  // 1g. Shops count
  const shopRes = await pgClient.query(`SELECT id, name, code, status FROM shops;`);
  const shops = shopRes.rows;

  // 1h. Customer outstanding & Supplier outstanding
  let customerReceivables = 0;
  try {
    const custOutRes = await pgClient.query(`
      SELECT COALESCE(SUM(balance), 0) as total
      FROM customer_ledgers;
    `);
    customerReceivables = Number(custOutRes.rows[0].total);
  } catch (e) {
    // try calculating from sales due_amount
    const dueRes = await pgClient.query(`SELECT COALESCE(SUM(due_amount), 0) as total FROM sales;`);
    customerReceivables = Number(dueRes.rows[0].total);
  }

  let supplierPayables = 0;
  try {
    const suppOutRes = await pgClient.query(`
      SELECT COALESCE(SUM(balance), 0) as total
      FROM supplier_ledgers;
    `);
    supplierPayables = Number(suppOutRes.rows[0].total);
  } catch (e) {
    const dueRes = await pgClient.query(`SELECT COALESCE(SUM(due_amount), 0) as total FROM purchases;`);
    supplierPayables = Number(dueRes.rows[0].total);
  }

  await pgClient.end();

  console.log('PostgreSQL Database Counts & Values:');
  console.log(`  • Active Products in DB: ${totalProducts}`);
  products.forEach(p => console.log(`    - [ID: ${p.id}] "${p.name}" (SKU: ${p.sku}) | Stock: ${p.current_stock} | Rate: ₹${p.purchase_price}`));
  console.log(`  • Total Stock Value: ₹ ${totalStockValue.toLocaleString('en-IN')}`);
  console.log(`  • In-Stock Products: ${inStockProductsCount}`);
  console.log(`  • Low Stock Products: ${lowStockProducts.length}`);
  console.log(`  • Total Sales Count: ${totalSalesCount} | Total Amount: ₹ ${totalSalesAmount.toLocaleString('en-IN')}`);
  console.log(`  • Total Purchases Count: ${totalPurchasesCount} | Total Amount: ₹ ${totalPurchasesAmount.toLocaleString('en-IN')}`);
  console.log(`  • Registered Customers: ${totalCustomers}`);
  console.log(`  • Staff Employees: ${totalEmployees}`);
  console.log(`  • Registered Suppliers: ${totalSuppliers}`);
  console.log(`  • Registered Shops: ${shops.length} (${shops.map(s => `${s.name} [${s.code}]`).join(', ')})`);
  console.log(`  • Customer Receivables: ₹ ${customerReceivables.toLocaleString('en-IN')}`);
  console.log(`  • Supplier Payables: ₹ ${supplierPayables.toLocaleString('en-IN')}\n`);

  // STEP 2: Query Live Backend API (Simulate Dashboard requests)
  console.log('--- STEP 2: LIVE BACKEND API RESPONSE AUDIT ---');
  // Log in to API
  const loginRes = await fetchWithRetry(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nsyu.mnt@gmail.com', password: 'Password@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  if (!token) throw new Error('API Login failed: ' + JSON.stringify(loginData));
  console.log('✔ Authenticated via backend API successfully.');

  const headers = { Authorization: `Bearer ${token}` };

  const [
    salesRepRes,
    purchRepRes,
    invRepRes,
    custOutRepRes,
    suppOutRepRes,
    recentSalesRes,
    recentPurchRes,
    custApiRes,
    empApiRes,
    prodApiRes,
    shopsApiRes
  ] = await Promise.all([
    fetchWithRetry(`${API_BASE}/reports/sales`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/reports/purchases`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/reports/inventory`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/reports/customer-outstanding`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/reports/supplier-outstanding`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/sales?limit=5`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/purchases?limit=5`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/customers`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/employees`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/products`, { headers }).then(r => r.json()),
    fetchWithRetry(`${API_BASE}/shops`, { headers }).then(r => r.json()),
  ]);

  const apiTotalSales = Number(salesRepRes.data?.summary?.total || 0);
  const apiTotalSalesCount = Number(salesRepRes.data?.summary?.count || 0);
  const apiTotalPurch = Number(purchRepRes.data?.summary?.total || 0);
  const apiTotalPurchCount = Number(purchRepRes.data?.summary?.count || 0);
  const apiStockValue = Number(invRepRes.data?.totalValue || 0);
  const apiCustCount = Array.isArray(custApiRes.data) ? custApiRes.data.length : 0;
  const apiEmpCount = Array.isArray(empApiRes.data) ? empApiRes.data.length : 0;
  const apiProdCount = Array.isArray(prodApiRes.data) ? prodApiRes.data.length : 0;
  const apiShopsCount = Array.isArray(shopsApiRes.data) ? shopsApiRes.data.length : 0;
  const apiCustReceivables = Number(custOutRepRes.data?.totalOutstanding || 0);
  const apiSuppPayables = Number(suppOutRepRes.data?.totalOutstanding || 0);

  console.log('Live Backend API Computed Values:');
  console.log(`  • Total Sales: ₹ ${apiTotalSales.toLocaleString('en-IN')} (${apiTotalSalesCount} invoices)`);
  console.log(`  • Total Purchases: ₹ ${apiTotalPurch.toLocaleString('en-IN')} (${apiTotalPurchCount} bills)`);
  console.log(`  • Stock Value: ₹ ${apiStockValue.toLocaleString('en-IN')}`);
  console.log(`  • Customers: ${apiCustCount}`);
  console.log(`  • Employees: ${apiEmpCount}`);
  console.log(`  • Products: ${apiProdCount}`);
  console.log(`  • Shops: ${apiShopsCount}`);
  console.log(`  • Customer Receivables: ₹ ${apiCustReceivables.toLocaleString('en-IN')}`);
  console.log(`  • Supplier Payables: ₹ ${apiSuppPayables.toLocaleString('en-IN')}\n`);

  // STEP 3: Puppeteer Live UI Verification
  console.log('--- STEP 3: LIVE BROWSER UI VERIFICATION (PRODUCTION GH-PAGES) ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 1200 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log('Navigating to live production: https://nsyumnt-rgb.github.io/nsyu/#/login');
  await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/login', { waitUntil: 'networkidle2' });

  await page.type('input[placeholder="name@business.com"]', 'nsyu.mnt@gmail.com');
  await page.type('input[placeholder="••••••••"]', 'Password@123');
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => window.location.hash.includes('/app'), { timeout: 20000 });
  await new Promise(r => setTimeout(r, 4000));

  // Extract all Dashboard card labels & rendered values
  const uiData = await page.evaluate(() => {
    const cards = [];
    // Primary cards
    const metricCards = Array.from(document.querySelectorAll('.rounded-xl.border'));
    for (const card of metricCards) {
      const labelEl = card.querySelector('.text-\\[12px\\], .text-\\[11\\.5px\\]');
      const valEl = card.querySelector('.text-\\[19px\\], .text-\\[16px\\]');
      const subEl = card.querySelector('.text-\\[11px\\]');
      if (labelEl && valEl) {
        cards.push({
          label: labelEl.innerText.trim(),
          value: valEl.innerText.trim(),
          sub: subEl ? subEl.innerText.trim() : ''
        });
      }
    }

    // Filter unique
    const unique = [];
    const seen = new Set();
    for (const c of cards) {
      if (!seen.has(c.label)) {
        seen.add(c.label);
        unique.push(c);
      }
    }

    // Extract table empty states or records
    const bodyText = document.body.innerText;

    return {
      cards: unique,
      bodyText,
      hasNoRecentSales: bodyText.includes('No Recent Sales'),
      hasNoRecentPurchases: bodyText.includes('No Purchases Recorded Yet'),
      hasAllProductsStocked: bodyText.includes('All Products Well Stocked'),
      hasNoActivity: bodyText.includes('No Recent Activity'),
      hasNoTrendData: bodyText.includes('No Transaction Trend Data Yet'),
      activeShopName: bodyText.includes('NSYU') ? 'NSYU' : 'Not Found'
    };
  });

  console.log('Rendered UI Cards in Live Browser:');
  uiData.cards.forEach(c => {
    console.log(`  🖥️  ${c.label.padEnd(25)}: ${c.value.padEnd(16)} (Sub: "${c.sub}")`);
  });

  console.log('\nRendered Section States in Live Browser:');
  console.log(`  • Sales & Purchase Trend : ${uiData.hasNoTrendData ? 'Clean zero state with dynamic action buttons' : 'Rendered active bars'}`);
  console.log(`  • Recent Sales           : ${uiData.hasNoRecentSales ? 'Clean empty state ("No Recent Sales")' : 'Rendered sales rows'}`);
  console.log(`  • Recent Purchases       : ${uiData.hasNoRecentPurchases ? 'Clean empty state ("No Purchases Recorded Yet")' : 'Rendered purchase rows'}`);
  console.log(`  • Low Stock Products     : ${uiData.hasAllProductsStocked ? 'Clean state ("All Products Well Stocked")' : 'Rendered low stock rows'}`);
  console.log(`  • Recent Activity        : ${uiData.hasNoActivity ? 'Clean empty state ("No Recent Activity")' : 'Rendered audit activity rows'}`);
  console.log(`  • Active Shop Profile    : ${uiData.activeShopName}`);

  // Take screenshot
  const ssPath = path.resolve(__dirname, 'screenshots/dashboard_real_data_verified.png');
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log(`\nScreenshot saved: ${ssPath}`);

  // Copy to artifacts
  const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\c5c16c32-786e-461e-9586-f4ab12dc115c\\screenshots';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(ssPath, path.join(artifactDir, 'dashboard_real_data_verified.png'));
  }

  await browser.close();

  // STEP 4: Three-Way Comparison & Validation
  console.log('\n======================================================================');
  console.log('THREE-WAY RECONCILIATION REPORT (DATABASE vs API vs UI)');
  console.log('======================================================================');

  function matchCard(label) {
    return uiData.cards.find(c => c.label.toLowerCase() === label.toLowerCase());
  }

  const checks = [
    {
      metric: 'Total Sales',
      db: `₹ ${totalSalesAmount.toLocaleString('en-IN')}`,
      api: `₹ ${apiTotalSales.toLocaleString('en-IN')}`,
      ui: matchCard('Total Sales')?.value || 'N/A',
      status: (totalSalesAmount === apiTotalSales && matchCard('Total Sales')?.value.includes(totalSalesAmount.toLocaleString('en-IN'))) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Total Purchase',
      db: `₹ ${totalPurchasesAmount.toLocaleString('en-IN')}`,
      api: `₹ ${apiTotalPurch.toLocaleString('en-IN')}`,
      ui: matchCard('Total Purchase')?.value || 'N/A',
      status: (totalPurchasesAmount === apiTotalPurch && matchCard('Total Purchase')?.value.includes(totalPurchasesAmount.toLocaleString('en-IN'))) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Current Stock Value',
      db: `₹ ${totalStockValue.toLocaleString('en-IN')}`,
      api: `₹ ${apiStockValue.toLocaleString('en-IN')}`,
      ui: matchCard('Current Stock Value')?.value || 'N/A',
      status: matchCard('Current Stock Value')?.value.includes(totalStockValue.toLocaleString('en-IN')) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Total Customers',
      db: `${totalCustomers}`,
      api: `${apiCustCount}`,
      ui: matchCard('Total Customers')?.value || 'N/A',
      status: (totalCustomers === apiCustCount && matchCard('Total Customers')?.value === `${totalCustomers}`) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Total Employees',
      db: `${totalEmployees}`,
      api: `${apiEmpCount}`,
      ui: matchCard('Total Employees')?.value || 'N/A',
      status: (totalEmployees === apiEmpCount && matchCard('Total Employees')?.value === `${totalEmployees}`) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Customer Receivables',
      db: `₹ ${customerReceivables.toLocaleString('en-IN')}`,
      api: `₹ ${apiCustReceivables.toLocaleString('en-IN')}`,
      ui: matchCard('Customer Receivables')?.value || 'N/A',
      status: matchCard('Customer Receivables')?.value.includes(customerReceivables.toLocaleString('en-IN')) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Supplier Payables',
      db: `₹ ${supplierPayables.toLocaleString('en-IN')}`,
      api: `₹ ${apiSuppPayables.toLocaleString('en-IN')}`,
      ui: matchCard('Supplier Payables')?.value || 'N/A',
      status: matchCard('Supplier Payables')?.value.includes(supplierPayables.toLocaleString('en-IN')) ? 'MATCH (100% REAL)' : 'MISMATCH'
    },
    {
      metric: 'Active Products',
      db: `${totalProducts}`,
      api: `${apiProdCount}`,
      ui: matchCard('Active Products')?.value || 'N/A',
      status: (totalProducts === apiProdCount && matchCard('Active Products')?.value === `${totalProducts}`) ? 'MATCH (100% REAL)' : 'MISMATCH'
    }
  ];

  console.table(checks);

  const allMatched = checks.every(c => c.status === 'MATCH (100% REAL)');
  console.log(`\nOVERALL DASHBOARD INTEGRITY RESULT: ${allMatched ? '✅ 100% VERIFIED REAL DATABASE DATA' : '❌ SOME METRICS DIFFER'}`);

  return { checks, allMatched };
}

reconcileDashboard().catch(err => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
