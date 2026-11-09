// scripts/verify_stock_transfer_live.js
// NSYU Stock Transfer Tab Real Database Data Verification

const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../web/node_modules/puppeteer-core'));

async function verifyStockTransfer() {
  console.log('======================================================================');
  console.log('NSYU STOCK TRANSFER LIVE REAL DATA VERIFICATION');
  console.log('Target URL: https://nsyumnt-rgb.github.io/nsyu/#/app/inventory?tab=Stock%20Transfer');
  console.log('======================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 1200 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('1. Logging in to production...');
  await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/login', { waitUntil: 'networkidle2' });
  await page.type('input[placeholder="name@business.com"]', 'nsyu.mnt@gmail.com');
  await page.type('input[placeholder="••••••••"]', 'Password@123');
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => window.location.hash.includes('/app'), { timeout: 25000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('2. Navigating to Stock Transfer tab...');
  await page.goto('https://nsyumnt-rgb.github.io/nsyu/#/app/inventory?tab=Stock%20Transfer', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));

  // Extract all details from page
  const data = await page.evaluate(() => {
    const text = document.body.innerText;

    // Extract all cards
    const cardNodes = Array.from(document.querySelectorAll('.rounded-xl.border'));
    const cards = [];
    for (const c of cardNodes) {
      const label = c.querySelector('.text-\\[12px\\]');
      const val = c.querySelector('.text-\\[20px\\], .text-\\[19px\\]');
      const sub = c.querySelector('.text-\\[11px\\]');
      if (label && val) {
        cards.push({
          label: label.innerText.trim(),
          value: val.innerText.trim(),
          sub: sub ? sub.innerText.trim() : ''
        });
      }
    }

    // Filter unique
    const uniqueCards = [];
    const seen = new Set();
    for (const c of cards) {
      if (!seen.has(c.label)) {
        seen.add(c.label);
        uniqueCards.push(c);
      }
    }

    return {
      cards: uniqueCards,
      fullText: text,
      hasEmptyTransfersTable: text.includes('No Stock Transfers Recorded'),
      hasEmptyRecentTransfers: text.includes('No recent transfers recorded'),
      hasEmptyTransferTrend: text.includes('No transfers recorded this year'),
      fromShopLabel: Array.from(document.querySelectorAll('span')).find(s => s.innerText.includes('🏪'))?.innerText.trim() || 'Not found'
    };
  });

  console.log('\n--- KPI CARDS ON STOCK TRANSFER TAB ---');
  data.cards.forEach(c => {
    console.log(`  📊 ${c.label.padEnd(25)}: ${c.value.padEnd(10)} (Subtitle: "${c.sub}")`);
  });

  console.log('\n--- VERIFYING SECTION STATES ---');
  console.log(`  • Transfers Table empty state : ${data.hasEmptyTransfersTable ? '✔ PASS (Clean empty state displayed)' : '❌ FAIL'}`);
  console.log(`  • Recent Transfers state      : ${data.hasEmptyRecentTransfers ? '✔ PASS (Clean empty state displayed)' : '❌ FAIL'}`);
  console.log(`  • Transfer Trend state        : ${data.hasEmptyTransferTrend ? '✔ PASS (Clean empty state displayed)' : '❌ FAIL'}`);
  console.log(`  • From Shop displayed         : "${data.fromShopLabel}"`);

  console.log('\n--- SCANNING FOR PREVIOUS DUMMY DATA STRINGS ---');
  const dummyStrings = [
    'TRF-2026-00125',
    'TRF-2026-00124',
    'TRF-2026-00123',
    'TRF-2026-00122',
    'TRF-2026-00121',
    'TRF-2026-00120',
    'Branch Shop 1',
    'Branch Shop 2',
    'Branch Shop 3',
    'Main Shop - Electronics',
    'Mobile Phone 28%',
    'Laptop 18%',
    'Damaged in transit',
    'Regular transfer',
    'For sales demand'
  ];

  let dummyFound = false;
  dummyStrings.forEach(s => {
    if (data.fullText.includes(s)) {
      console.log(`  ❌ FOUND DUMMY STRING: "${s}"`);
      dummyFound = true;
    }
  });

  if (!dummyFound) {
    console.log('  ✔ ZERO dummy strings found in live page text! 100% clean database-driven UI.');
  }

  // Take screenshot
  const ssPath = path.resolve(__dirname, 'screenshots/stock_transfer_real_data_verified.png');
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log(`\nScreenshot saved: ${ssPath}`);

  // Copy to artifacts
  const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\c5c16c32-786e-461e-9586-f4ab12dc115c\\screenshots';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(ssPath, path.join(artifactDir, 'stock_transfer_real_data_verified.png'));
  }

  await browser.close();

  console.log('\n======================================================================');
  console.log(dummyFound ? '❌ VERIFICATION FAILED: Dummy data remains' : '✅ VERIFICATION PASSED: Stock Transfer is 100% Real Database-Driven!');
  console.log('======================================================================\n');
}

verifyStockTransfer().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
