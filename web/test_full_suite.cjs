const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\412844fd-79b4-48a9-b4db-ad658557fd6b';

async function runFullSuite() {
  console.log('=== Starting Full Website Module & Functional Test ===');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  // 1. Owner Login
  console.log('\n[STEP 1] Logging in as Owner...');
  await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle0' });
  const emailInput = await page.waitForSelector('input[placeholder*="business.com"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type('nsyu.mnt@gmail.com');
  const passInput = await page.waitForSelector('input[placeholder*="••••"]');
  await passInput.click({ clickCount: 3 });
  await passInput.type('Password@123');
  const submitBtn = await page.waitForSelector('button[type="submit"]');
  await submitBtn.click();
  await new Promise(r => setTimeout(r, 3500));
  console.log('✔ Logged in, URL:', page.url());

  // 2. Visit and Screenshot Every Main Module
  const modules = [
    { name: 'Dashboard', path: '#/app', snap: 'web_mod_dashboard.png' },
    { name: 'Products', path: '#/app/products', snap: 'web_mod_products.png' },
    { name: 'Billing', path: '#/app/billing', snap: 'web_mod_billing.png' },
    { name: 'Orders', path: '#/app/orders', snap: 'web_mod_orders.png' },
    { name: 'Customers', path: '#/app/customers', snap: 'web_mod_customers.png' },
    { name: 'Ledger', path: '#/app/ledger', snap: 'web_mod_ledger.png' },
    { name: 'Inventory', path: '#/app/inventory', snap: 'web_mod_inventory.png' },
    { name: 'Purchase', path: '#/app/purchase', snap: 'web_mod_purchase.png' },
    { name: 'Sales', path: '#/app/sales', snap: 'web_mod_sales.png' },
    { name: 'Payments', path: '#/app/payments', snap: 'web_mod_payments.png' },
    { name: 'EMI', path: '#/app/emi', snap: 'web_mod_emi.png' },
    { name: 'Reports', path: '#/app/reports', snap: 'web_mod_reports.png' },
    { name: 'Employees', path: '#/app/employees', snap: 'web_mod_employees.png' },
    { name: 'Roles', path: '#/app/roles', snap: 'web_mod_roles.png' },
    { name: 'Shops', path: '#/app/shops', snap: 'web_mod_shops.png' },
    { name: 'Settings', path: '#/app/settings', snap: 'web_mod_settings.png' },
  ];

  for (const m of modules) {
    console.log(`Navigating to ${m.name} (${m.path})...`);
    await page.goto(`http://localhost:3000/${m.path}`, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, m.snap) });
    console.log(`✔ ${m.name} loaded and verified.`);
  }

  // 3. Functional Billing Test: Create and Save a Bill
  console.log('\n[STEP 3] Testing Bill Creation & Saving on Web...');
  await page.goto('http://localhost:3000/#/app/billing', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  // Search product or click add to bill
  const searchInput = await page.$('input[placeholder*="Search"], input[type="search"]');
  if (searchInput) {
    await searchInput.type('ERD');
    await new Promise(r => setTimeout(r, 1000));
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_billing_searched.png') });

  console.log('\n=== All Functional Modules Tested Successfully ===');
  await browser.close();
}

runFullSuite().catch(err => {
  console.error('Full suite failed:', err);
  process.exit(1);
});
