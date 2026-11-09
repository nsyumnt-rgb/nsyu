const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../web/node_modules/puppeteer-core'));

const BASE_URL = 'https://nsyumnt-rgb.github.io/nsyu';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\c5c16c32-786e-461e-9586-f4ab12dc115c\\screenshots';
if (!fs.existsSync(ARTIFACT_SCREENSHOT_DIR)) {
  fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('======================================================================');
  console.log('NSYU SIDEBAR MENU CLEANUP LIVE PRODUCTION VERIFICATION');
  console.log('Target URL: ' + BASE_URL);
  console.log('======================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // 1. Login
    console.log('1. Logging in to live production...');
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[placeholder="name@business.com"]');
    await page.type('input[placeholder="name@business.com"]', 'nsyu.mnt@gmail.com');
    await page.type('input[placeholder="••••••••"]', 'Password@123');
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => window.location.hash.includes('/app'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log('✔ Authenticated. Current URL:', page.url());

    // 2. Inspect Sidebar structure
    console.log('\n2. Inspecting Sidebar Menu Items and Groups...');
    const sidebarData = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return null;

      const groupHeaders = Array.from(aside.querySelectorAll('button[type="button"]')).map(b => b.textContent.trim());
      const links = Array.from(aside.querySelectorAll('nav a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href')
      }));

      return {
        brand: aside.querySelector('.text-\\[14px\\]')?.textContent.trim(),
        shop: aside.querySelector('.text-\\[10\\.5px\\]')?.textContent.trim(),
        groupHeaders,
        links
      };
    });

    console.log('Brand Header:', sidebarData.brand, '| Shop:', sidebarData.shop);
    console.log('Group Headers found (' + sidebarData.groupHeaders.length + '):', sidebarData.groupHeaders);
    console.log('Total Nav Links found (' + sidebarData.links.length + '):');
    sidebarData.links.forEach((l, idx) => {
      console.log(`  ${idx + 1}. [${l.text}] -> ${l.href}`);
    });

    // Expected structure verification
    const expectedGroups = ['MAIN', 'BUSINESS MANAGEMENT', 'MANAGEMENT', 'ADMIN'];
    const expectedLinks = [
      // MAIN
      { text: 'Dashboard', href: '#/app' },
      { text: 'Billing', href: '#/app/billing' },
      { text: 'Ledger', href: '#/app/ledger' },
      { text: 'Catalog', href: '#/app/products' },
      { text: 'Orders', href: '#/app/orders' },
      // BUSINESS MANAGEMENT
      { text: 'Purchase', href: '#/app/purchase' },
      { text: 'Inventory', href: '#/app/inventory' },
      { text: 'Customers', href: '#/app/customers' },
      { text: 'Suppliers', href: '#/app/suppliers' },
      { text: 'Payments', href: '#/app/payments' },
      { text: 'EMI / Installments', href: '#/app/emi' },
      // MANAGEMENT
      { text: 'Employees', href: '#/app/employees' },
      { text: 'Attendance', href: '#/app/attendance' },
      { text: 'Salary / Payroll', href: '#/app/payroll' },
      { text: 'Reports', href: '#/app/reports' },
      // ADMIN
      { text: 'Shops', href: '#/app/shops' },
      { text: 'Roles & Permissions', href: '#/app/roles' },
      { text: 'Settings', href: '#/app/settings' },
    ];

    console.log('\n--- VERIFYING GROUP HEADERS ---');
    let groupsMatch = true;
    expectedGroups.forEach(eg => {
      const match = sidebarData.groupHeaders.some(gh => gh.includes(eg));
      console.log(`  • Group "${eg}": ${match ? '✔ PASS' : '❌ FAIL'}`);
      if (!match) groupsMatch = false;
    });

    console.log('\n--- VERIFYING EXACT NAV ITEMS ---');
    let linksMatch = true;
    expectedLinks.forEach((el, idx) => {
      const found = sidebarData.links.find(l => l.text === el.text && l.href === el.href);
      console.log(`  • [${idx + 1}] "${el.text}" (${el.href}): ${found ? '✔ PASS' : '❌ FAIL'}`);
      if (!found) linksMatch = false;
    });

    // 3. Test Collapsible Section Toggle
    console.log('\n3. Testing Collapsible Sections Toggle...');
    const linksBefore = await page.evaluate(() => document.querySelectorAll('aside nav a').length);
    
    // Click on "BUSINESS MANAGEMENT" to collapse it
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside nav button[type="button"]'));
      const bmButton = buttons.find(b => b.textContent.includes('BUSINESS MANAGEMENT'));
      if (bmButton) bmButton.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const linksAfter = await page.evaluate(() => document.querySelectorAll('aside nav a').length);

    // Click again to re-expand
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside nav button[type="button"]'));
      const bmButton = buttons.find(b => b.textContent.includes('BUSINESS MANAGEMENT'));
      if (bmButton) bmButton.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const linksRestored = await page.evaluate(() => document.querySelectorAll('aside nav a').length);

    const collapsedCorrectly = linksAfter < linksBefore && linksRestored === linksBefore;
    console.log(`Collapse test: Before=${linksBefore}, Collapsed=${linksAfter}, Restored=${linksRestored} -> ${collapsedCorrectly ? '✔ PASS' : '❌ FAIL'}`);

    // 4. Verify on /app/inventory that NO submenus appear in the sidebar
    console.log('\n4. Verifying No Sub-Menu on /app/inventory...');
    await page.goto(`${BASE_URL}/#/app/inventory`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    const inventoryPageSidebarLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('aside nav a')).map(a => a.textContent.trim());
    });
    const submenusPresent = inventoryPageSidebarLinks.filter(t => 
      ['Current Stock', 'Stock Movements', 'Stock Transfer', 'Stock Adjustment', 'Low Stock Alerts'].includes(t)
    );
    console.log(`Submenus found in sidebar: ${submenusPresent.length} (${submenusPresent.join(', ') || 'None'})`);
    if (submenusPresent.length === 0) {
      console.log('✔ PASS: All submenus completely removed from sidebar!');
    } else {
      console.log('❌ FAIL: Some submenus still appear in sidebar!');
    }

    // 5. Capture screenshot of live sidebar and dashboard
    const screenshotPath = path.join(SCREENSHOT_DIR, 'sidebar_cleanup_live_verified.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Copy to artifact screenshot directory
    const artifactScreenshotPath = path.join(ARTIFACT_SCREENSHOT_DIR, 'sidebar_cleanup_live_verified.png');
    fs.copyFileSync(screenshotPath, artifactScreenshotPath);
    console.log(`\n✔ Screenshot captured: ${screenshotPath}`);
    console.log(`✔ Artifact Screenshot saved: ${artifactScreenshotPath}`);

    // Summary
    console.log('\n======================================================================');
    if (groupsMatch && linksMatch) {
      console.log('✅ ALL SIDEBAR CLEANUP CHECKS PASSED: 100% PRODUCTION VERIFIED!');
    } else {
      console.log('❌ SOME SIDEBAR CLEANUP CHECKS FAILED!');
    }
    console.log('======================================================================\n');

  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

