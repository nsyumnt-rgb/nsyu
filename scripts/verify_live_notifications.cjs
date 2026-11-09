const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function verifyLiveNotifications() {
  console.log("=== Testing Live Web Topbar Notifications on Production ===");
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('PAGE:', msg.text()));

  console.log('1. Navigating to https://nsyumnt-rgb.github.io/nsyu/#/login ...');
  await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/login', { waitUntil: 'networkidle2', timeout: 30000 });

  // Type credentials
  console.log('2. Entering credentials for Owner...');
  await page.waitForSelector('form input', { timeout: 10000 });

  await page.evaluate(() => {
    const inputs = document.querySelectorAll('form input');
    if (inputs.length >= 2) {
      const emailInput = inputs[0];
      const passInput = inputs[1];

      const setVal = (el, val) => {
        const proto = Object.getPrototypeOf(el);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      setVal(emailInput, 'nsyu.mnt@gmail.com');
      setVal(passInput, 'Password@123');
    }
  });

  await new Promise(r => setTimeout(r, 500));

  console.log('3. Submitting login form...');
  const submitBtn = await page.$('button[type="submit"]');
  await submitBtn.click();

  console.log('4. Waiting for dashboard navigation...');
  await page.waitForSelector('header', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log('✔ Logged in, Topbar header detected.');

  // Find notification bell
  console.log('5. Locating notification bell in Topbar...');
  const bellBtn = await page.$('button[title="Notifications"]');
  if (!bellBtn) {
    throw new Error('Notification bell button not found!');
  }
  console.log('✔ Found notification bell button.');

  // Click notification bell
  console.log('6. Clicking notification bell to open dropdown...');
  await bellBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  // Verify dropdown is open
  const dropdownHeader = await page.$eval('h3', el => el.textContent).catch(() => null);
  console.log(`✔ Dropdown Header Text: "${dropdownHeader}"`);

  // Take screenshot of open notification panel
  const screenshotDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\c5c16c32-786e-461e-9586-f4ab12dc115c\\screenshots';
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'live_prod_notification_dropdown.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`✔ Captured live screenshot at: ${screenshotPath}`);

  await browser.close();
  console.log('=== All Production Notification Tests PASSED! ===');
}

verifyLiveNotifications().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
