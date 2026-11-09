const path = require('path');
const puppeteer = require(path.resolve(__dirname, '../web/node_modules/puppeteer-core'));
(async () => {
  const browser = await puppeteer.launch({ 
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 
    headless: 'new' 
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log('API RES:', res.url(), res.status());
    }
  });

  await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/login', { waitUntil: 'networkidle2' });
  await page.focus('#identifier-input');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('#identifier-input', 'superadmin@nsyu.com');

  await page.focus('#password-input');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('#password-input', 'SuperAdmin@123');

  await page.click('#login-submit-btn');
  await new Promise(r => setTimeout(r, 4000));

  const url = page.url();
  console.log('URL:', url);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('PAGE TEXT:\n', text);
  await browser.close();
})();
