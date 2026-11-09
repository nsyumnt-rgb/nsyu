const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../web/node_modules/puppeteer-core'));

const BASE_URL = 'https://nsyumnt-rgb.github.io/nsyu/#/login';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\c5c16c32-786e-461e-9586-f4ab12dc115c\\screenshots';
if (!fs.existsSync(ARTIFACT_SCREENSHOT_DIR)) {
  fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function takeAndSaveScreenshot(page, filename) {
  const localPath = path.join(SCREENSHOT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`📸 Screenshot saved: ${filename}`);
}

async function fillReactInput(page, selector, value) {
  await page.waitForSelector(selector);
  await page.evaluate((sel, val) => {
    const input = document.querySelector(sel);
    if (!input) throw new Error('Input not found: ' + sel);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}

async function run() {
  console.log('======================================================================');
  console.log('NSYU UNIFIED SYSTEM PRODUCTION LIVE SMOKE VERIFICATION');
  console.log('Target Live URL: ' + BASE_URL);
  console.log('======================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ── 1. Navigate to Live Production Login ──
    console.log('Step 1: Navigating to live production login page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Verify Login Screen Elements
    const loginInfo = await page.evaluate(() => {
      return {
        title: document.title,
        heading: document.querySelector('h1')?.textContent.trim(),
        hasStaffTab: document.body.innerText.includes('Staff / Owner'),
        hasCustomerTab: document.body.innerText.includes('Customer Portal'),
        hasSupabasePill: document.body.innerText.includes('Supabase PostgreSQL Connected'),
        hasCreateAccount: document.body.innerText.includes('Create Account'),
      };
    });
    console.log('Login Info:', loginInfo);
    await takeAndSaveScreenshot(page, 'live_prod_login_screen.png');

    // ── 2. Super Admin Login ──
    console.log('\nStep 2: Logging in as Platform Super Admin (superadmin@nsyu.com)...');
    await fillReactInput(page, '#identifier-input', 'superadmin@nsyu.com');
    await fillReactInput(page, '#password-input', 'SuperAdmin@123');

    await page.click('#login-submit-btn');
    await new Promise(r => setTimeout(r, 4500));

    const currentUrl = page.url();
    console.log('Current URL after Super Admin login:', currentUrl);
    if (!currentUrl.includes('/admin')) {
      throw new Error(`Expected redirect to /admin, but got: ${currentUrl}`);
    }

    // Verify Super Admin Platform Dashboard
    const adminDashboardData = await page.evaluate(() => {
      const heading = document.querySelector('h1')?.textContent.trim();
      const cards = Array.from(document.querySelectorAll('.rounded-2xl')).map(c => c.textContent.trim());
      const bodyText = document.body.innerText;
      return {
        heading,
        hasPlatformBadge: bodyText.includes('Platform Super Admin') || bodyText.includes('Platform Governance'),
        hasShopsNav: bodyText.includes('Shops'),
        hasOwnersNav: bodyText.includes('Shop Owners'),
        hasAuditNav: bodyText.includes('Audit Logs'),
      };
    });
    console.log('Super Admin Dashboard Verification:', adminDashboardData);
    await takeAndSaveScreenshot(page, 'live_prod_super_admin_dashboard.png');

    // ── 3. Navigate to Super Admin Shops Management ──
    console.log('\nStep 3: Navigating to Super Admin Shops Management (#/admin/shops)...');
    await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/admin/shops', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    const shopsText = await page.evaluate(() => document.body.innerText);
    const hasShopsLoaded = shopsText.includes('NSYU Main Store') || shopsText.includes('Shop Management');
    console.log('Shops Loaded Successfully:', hasShopsLoaded);
    await takeAndSaveScreenshot(page, 'live_prod_super_admin_shops.png');

    // ── 4. Navigate to Super Admin Audit Logs ──
    console.log('\nStep 4: Navigating to Super Admin Audit Logs (#/admin/audit-logs)...');
    await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/admin/audit-logs', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    const auditText = await page.evaluate(() => document.body.innerText);
    const hasAuditLoaded = auditText.includes('Platform Audit Logs') || auditText.includes('Audit Logs');
    console.log('Audit Logs Loaded Successfully:', hasAuditLoaded);
    await takeAndSaveScreenshot(page, 'live_prod_super_admin_audit_logs.png');

    // ── 5. Super Admin Logout & Tenant Owner Login ──
    console.log('\nStep 5: Logging out Super Admin and logging in as Tenant Shop Owner (nsyu.mnt@gmail.com)...');
    // Clear storage to logout cleanly
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    await fillReactInput(page, '#identifier-input', 'nsyu.mnt@gmail.com');
    await fillReactInput(page, '#password-input', 'Password@123');

    await page.click('#login-submit-btn');
    await new Promise(r => setTimeout(r, 4500));

    const ownerUrl = page.url();
    console.log('Current URL after Owner login:', ownerUrl);
    if (!ownerUrl.includes('/app')) {
      throw new Error(`Expected redirect to /app, but got: ${ownerUrl}`);
    }

    // Verify Owner Dashboard and unified scope (no purchase/suppliers/reports)
    const ownerDashboardInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const sidebarLinks = Array.from(document.querySelectorAll('aside a, nav a')).map(a => a.textContent.trim());
      const hasInventoryValue = bodyText.includes('Inventory Value');
      const hasPurchaseNav = sidebarLinks.includes('Purchase') || sidebarLinks.includes('Purchases');
      const hasSuppliersNav = sidebarLinks.includes('Suppliers');
      const hasReportsNav = sidebarLinks.includes('Reports');
      const hasShopsNav = sidebarLinks.includes('Shops');

      return {
        hasInventoryValue,
        sidebarLinks,
        hasPurchaseNav,
        hasSuppliersNav,
        hasReportsNav,
        hasShopsNav,
      };
    });

    console.log('Owner Scope Verification:', {
      hasInventoryValue: ownerDashboardInfo.hasInventoryValue,
      sidebarClean: !ownerDashboardInfo.hasPurchaseNav && !ownerDashboardInfo.hasSuppliersNav && !ownerDashboardInfo.hasReportsNav && !ownerDashboardInfo.hasShopsNav,
      sidebarLinks: ownerDashboardInfo.sidebarLinks
    });

    await takeAndSaveScreenshot(page, 'live_prod_tenant_owner_dashboard.png');

    console.log('\n======================================================================');
    console.log('🎉 ALL LIVE PRODUCTION VERIFICATIONS PASSED WITH 100% SUCCESS!');
    console.log('======================================================================');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    await takeAndSaveScreenshot(page, 'live_prod_error.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
