// scripts/inspect_pages_for_mock_data.js
const fs = require('fs');
const path = require('path');

const pagesDir = path.resolve('web/src/pages');
const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const p of pages) {
  const content = fs.readFileSync(path.join(pagesDir, p), 'utf8');
  // Check for dummy arrays or static fallback structures
  const lines = content.split('\n');
  const suspLines = [];
  lines.forEach((l, idx) => {
    // look for inline arrays of objects with hardcoded names/numbers
    if (l.includes('const default') || l.includes('const mock') || l.includes('const dummy') || l.includes('const sample') || l.includes('const initial') || l.includes('fallback =')) {
      suspLines.push({ line: idx + 1, text: l.trim() });
    }
    if ((l.includes('INV-') || l.includes('PUR-') || l.includes('CUST-')) && !l.includes('api') && !l.includes('import') && !l.includes('test')) {
      suspLines.push({ line: idx + 1, text: l.trim() });
    }
  });
  if (suspLines.length > 0) {
    console.log(`\n=== ${p} ===`);
    suspLines.forEach(s => console.log(`  Line ${s.line}: ${s.text.slice(0, 120)}`));
  }
}

