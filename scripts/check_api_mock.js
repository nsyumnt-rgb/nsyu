const fs = require('fs');
const path = require('path');

const API_DIR = path.resolve(__dirname, '../api/src');

function search(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'seed') search(full);
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      if (/mock|dummy|fake|sample/i.test(content)) {
        console.log(`Found keyword in ${path.relative(API_DIR, full)}`);
        const lines = content.split('\n');
        lines.forEach((l, idx) => {
          if (/mock|dummy|fake|sample/i.test(l) && !l.trim().startsWith('//')) {
            console.log(`  L${idx+1}: ${l.trim().slice(0, 100)}`);
          }
        });
      }
    }
  }
}

search(API_DIR);

