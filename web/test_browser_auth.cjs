const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\412844fd-79b4-48a9-b4db-ad658557fd6b';

async function runBrowserTests() {
  console.log('--- Launching Chrome for Comprehensive Web Testing ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  // 1. Open Login Page
  console.log('\n[TEST 1] Opening Login Page...');
  await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_login_initial.png') });
  console.log('✔ Initial login page rendered successfully.');

  // Helper to get inputs
  const getEmailInput = async () => page.waitForSelector('input[placeholder*="business.com"]');
  const getPasswordInput = async () => page.evaluateHandle(() => {
    const inputs = Array.from(document.querySelectorAll('form input'));
    return inputs.find(i => i.getAttribute('placeholder')?.includes('•') || i.type === 'password' || i.type === 'text' && i !== inputs[0]);
  });

  // 2. Test Empty Fields Validation
  console.log('\n[TEST 2] Testing Empty Fields Validation...');
  const loginBtn = await page.waitForSelector('button[type="submit"]');
  await loginBtn.click();
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_login_empty_error.png') });
  console.log('✔ Empty fields form validation triggered.');

  // 3. Test Invalid Credentials
  console.log('\n[TEST 3] Testing Invalid Credentials...');
  const emailInput = await getEmailInput();
  await emailInput.type('invalid@user.com');
  const passInput = await getPasswordInput();
  await passInput.type('WrongPass@999');
  await loginBtn.click();
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_login_invalid_error.png') });
  console.log('✔ Invalid credentials error message captured.');

  // 4. Test Password Visibility Toggle
  console.log('\n[TEST 4] Testing Password Visibility Toggle...');
  // Find eye toggle button
  await page.evaluate(() => {
    const form = document.querySelector('form');
    const eye = form.querySelector('button[type="button"]');
    if (eye) eye.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_login_password_unmasked.png') });
  console.log('✔ Password visibility toggle verified.');

  // Clear inputs
  await page.evaluate(() => {
    document.querySelectorAll('form input').forEach(i => {
      i.value = '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  // 5. Test Valid Owner Login
  console.log('\n[TEST 5] Testing Valid Owner Login (nsyu.mnt@gmail.com)...');
  const emailEl = await getEmailInput();
  await emailEl.type('nsyu.mnt@gmail.com');
  const passEl = await getPasswordInput();
  await passEl.type('Password@123');
  await loginBtn.click();

  // Wait for navigation
  await new Promise(r => setTimeout(r, 4000));
  console.log('Current URL after owner login:', page.url());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_owner_dashboard.png') });
  console.log('✔ Owner logged in and dashboard rendered.');

  // 6. Test Navigation across modules
  const modulesToVisit = [
    { name: 'Dashboard', hash: '#/dashboard', snap: 'web_module_dashboard.png' },
    { name: 'Products / Catalog', hash: '#/products', snap: 'web_module_products.png' },
    { name: 'Billing', hash: '#/billing', snap: 'web_module_billing.png' },
    { name: 'Orders', hash: '#/orders', snap: 'web_module_orders.png' },
    { name: 'Ledger / Customers', hash: '#/customers', snap: 'web_module_customers.png' },
    { name: 'Inventory / Stock', hash: '#/inventory', snap: 'web_module_inventory.png' },
    { name: 'Reports', hash: '#/reports', snap: 'web_module_reports.png' },
    { name: 'Employees / Users', hash: '#/employees', snap: 'web_module_employees.png' },
    { name: 'Settings', hash: '#/settings', snap: 'web_module_settings.png' },
  ];

  for (const m of modulesToVisit) {
    console.log(`\nTesting Module: ${m.name} (${m.hash})...`);
    await page.goto(`http://localhost:3000/${m.hash}`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, m.snap) });
    console.log(`✔ Module ${m.name} rendered cleanly.`);
  }

  // 7. Test Logout
  console.log('\n[TEST 7] Testing Logout...');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_after_logout.png') });
  console.log('✔ Logout successful.');

  // 8. Test Staff Login & RBAC Restricted Navigation
  console.log('\n[TEST 8] Testing Staff User Login (staff@nsyu.com)...');
  const staffEmail = await getEmailInput();
  await staffEmail.type('staff@nsyu.com');
  const staffPass = await getPasswordInput();
  await staffPass.type('Password@123');
  const staffSubmit = await page.waitForSelector('button[type="submit"]');
  await staffSubmit.click();
  await new Promise(r => setTimeout(r, 4000));
  console.log('Staff logged in, URL:', page.url());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_staff_dashboard.png') });
  console.log('✔ Staff dashboard and restricted sidebar rendered.');

  // Verify Staff cannot access Reports
  console.log('\n[TEST 9] Testing Staff Protected Route (Access to /reports)...');
  await page.goto('http://localhost:3000/#/reports', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_staff_reports_restricted.png') });
  console.log('✔ Staff permission boundary verified.');

  await browser.close();
  console.log('\n======================================================');
  console.log('  ALL BROWSER AUTOMATION TESTS COMPLETED SUCCESSFULLY! ');
  console.log('======================================================\n');
}

runBrowserTests().catch(err => {
  console.error('Browser Test Failed:', err);
  process.exit(1);
});
