const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const rootDir = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  let filePath = path.join(rootDir, req.url.split('?')[0].split('#')[0]);
  if (filePath.endsWith('/') || filePath.endsWith('\\')) filePath += 'index.html';
  if (!fs.existsSync(filePath)) {
    filePath = path.join(rootDir, 'index.html');
  }
  const ext = path.extname(filePath);
  const mimeMap = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };
  res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
});

server.listen(4174, async () => {
  console.log('Preview server on http://localhost:4174');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Login
    await page.goto('http://localhost:4174/#/login', { waitUntil: 'networkidle2' });
    const emailInput = await page.$('input[type="email"], input[placeholder*="email" i], input[type="text"]');
    const passInput = await page.$('input[type="password"]');
    
    // Fill credentials
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('nsyu.mnt@gmail.com');
    await passInput.click({ clickCount: 3 });
    await passInput.type('Nsyu@12345');

    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    console.log('Logged in, current URL:', page.url());

    // 2. Navigate to Products
    await page.goto('http://localhost:4174/#/app/products', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Click "Add Product" button
    const addBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Add Product') || b.textContent.includes('Create Product'));
    });

    if (addBtn) {
      await addBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      console.log('Clicked Add Product button');

      // 4. Test Margin Calculation
      // Find Purchase Price input and Margin input
      const inputs = await page.$$('input[type="number"]');
      console.log(`Found ${inputs.length} number inputs in modal`);

      // Fill Purchase Price: 100, Margin: 20
      // In form: purchase_price is index 0, margin_amount is index 1, selling_price is index 2
      if (inputs.length >= 3) {
        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type('100');

        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type('20');

        await new Promise(r => setTimeout(r, 500));

        const sellingPriceVal = await page.evaluate(el => el.value, inputs[2]);
        console.log('Auto-calculated Selling Price:', sellingPriceVal);

        const artifactPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\412844fd-79b4-48a9-b4db-ad658557fd6b\\web_margin_formula_verified.png';
        await page.screenshot({ path: artifactPath });
        console.log('Screenshot saved to artifact:', artifactPath);
      }
    } else {
      console.log('Add Product button not found');
    }

    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
});

