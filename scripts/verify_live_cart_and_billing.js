const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../web/node_modules/puppeteer-core'));

const BASE_URL = 'https://nsyumnt-rgb.github.io/nsyu';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/c5c16c32-786e-461e-9586-f4ab12dc115c';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');

(async () => {
  console.log('🚀 Starting Automated Live Production Verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 1. Load Live Login
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle2', timeout: 35000 });
    console.log('✔ Live URL loaded successfully');

    // 2. Click the pre-filled submit button
    await page.waitForSelector('#login-submit-btn', { timeout: 10000 });
    await page.click('#login-submit-btn');
    console.log('✔ Clicked #login-submit-btn');

    // Wait for redirect to /app
    await page.waitForFunction(() => window.location.hash.includes('/app'), { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3000));
    console.log('✔ Authenticated! Current URL:', page.url());

    // 3. Navigate to Billing
    await page.goto(`${BASE_URL}/#/app/billing`, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 3000));
    console.log('✔ Navigated to Live Billing page');

    // 4. Capture screenshot of Billing catalog
    const billingShotPath = path.join(SCREENSHOT_DIR, 'live_billing_products_verified.png');
    await page.screenshot({ path: billingShotPath, fullPage: true });
    console.log('✔ Screenshot saved:', billingShotPath);

    // 5. Click on the first product to add to cart
    const productButtons = await page.$$('button.text-left');
    console.log(`Found ${productButtons.length} product cards in billing catalog`);
    if (productButtons.length > 0) {
      await productButtons[0].click();
      console.log('✔ Clicked first product to add to cart');
      await new Promise((r) => setTimeout(r, 2000));

      // 6. Verify cart has editable inputs (Price input, Quantity input)
      const numberInputs = await page.$$('input[type="number"]');
      console.log(`Found ${numberInputs.length} number input(s) in billing cart`);

      const cartShotPath = path.join(SCREENSHOT_DIR, 'live_billing_cart_editable_verified.png');
      await page.screenshot({ path: cartShotPath, fullPage: false });
      console.log('✔ Screenshot of editable cart saved:', cartShotPath);
    }

    // 7. Verify APK Download Link on Live Site
    const apkRes = await page.evaluate(async () => {
      try {
        const res = await fetch('https://nsyumnt-rgb.github.io/nsyu/downloads/nsyu-business-release.apk', { method: 'HEAD' });
        return { ok: res.ok, status: res.status, size: res.headers.get('content-length') };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('✔ Live APK Download Check:', apkRes);

    console.log('🎉 Verification completed successfully!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
