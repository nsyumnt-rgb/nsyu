const puppeteer = require('puppeteer-core');

async function testLiveSite() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.error('FAILED REQ:', req.url(), req.failure()?.errorText));

  console.log('Navigating to https://nsyumnt-rgb.github.io/nsyu/#/login ...');
  await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  try {
    await page.waitForSelector('form, input, button', { timeout: 10000 });
    console.log('Found form elements!');
  } catch (e) {
    console.log('Timed out waiting for form elements');
  }

  const html = await page.content();
  console.log('HTML snippet:', html.substring(0, 500));

  const screenshotPath = 'C:\\Users\\user\\.gemini\antigravity\\brain\\412844fd-79b4-48a9-b4db-ad658557fd6b\\web_live_debug.png';
  await page.screenshot({ path: screenshotPath });

  await browser.close();
}

testLiveSite().catch(console.error);
