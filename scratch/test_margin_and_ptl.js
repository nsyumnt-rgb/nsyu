const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Simple static server for docs/
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

server.listen(4173, async () => {
  console.log('Static preview server on http://localhost:4173');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Test PTL redirect
    console.log('Testing PTL redirect...');
    await page.goto('http://localhost:4173/PTL/', { waitUntil: 'networkidle2' });
    const ptlUrl = page.url();
    console.log('PTL redirected URL:', ptlUrl);

    // Test Login Page
    console.log('Testing Login page...');
    await page.goto('http://localhost:4173/#/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(__dirname, 'web_login_realigned.png') });
    console.log('Login screenshot captured.');

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

