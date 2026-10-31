const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\412844fd-79b4-48a9-b4db-ad658557fd6b';

async function runOwnerTests() {
  console.log('--- Testing Owner Login & Modules ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle0' });

  // Type Owner Credentials cleanly
  const emailInput = await page.waitForSelector('input[placeholder*="business.com"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type('nsyu.mnt@gmail.com');

  const passInput = await page.waitForSelector('input[placeholder*="••••"]');
  await passInput.click({ clickCount: 3 });
  await passInput.type('Password@123');

  const submitBtn = await page.waitForSelector('button[type="submit"]');
  await submitBtn.click();

  await new Promise(r => setTimeout(r, 4000));
  console.log('Owner logged in, current URL:', page.url());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_owner_dashboard_full.png') });

  // Test Each Page
  const pages = [
    { name: 'Products', hash: '#/products', snap: 'web_page_products.png' },
    { name: 'Billing', hash: '#/billing', snap: 'web_page_billing.png' },
    { name: 'Orders', hash: '#/orders', snap: 'web_page_orders.png' },
    { name: 'Customers', hash: '#/customers', snap: 'web_page_customers.png' },
    { name: 'Stock / Inventory', hash: '#/inventory', snap: 'web_page_inventory.png' },
    { name: 'Reports', hash: '#/reports', snap: 'web_page_reports.png' },
    { name: 'Employees', hash: '#/employees', snap: 'web_page_employees.png' },
    { name: 'Settings', hash: '#/settings', snap: 'web_page_settings.png' },
  ];

  for (const p of pages) {
    console.log(`Navigating to ${p.name}...`);
    await page.goto(`http://localhost:3000/${p.hash}`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, p.snap) });
    console.log(`✔ Captured ${p.name}`);
  }

  await browser.close();
  console.log('Owner modules testing completed successfully!');
}

runOwnerTests().catch(console.error);
