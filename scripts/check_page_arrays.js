const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.resolve(__dirname, '../web/src/pages');
const files = fs.readdirSync(PAGES_DIR);

files.forEach(f => {
  if (!f.endsWith('.tsx')) return;
  const content = fs.readFileSync(path.join(PAGES_DIR, f), 'utf8');
  
  // Look for const xxx = [ { ... }, { ... } ]
  const arrayMatches = content.match(/const\s+([A-Za-z0-9_]+)\s*(?::\s*[^=]+)?\s*=\s*\[\s*\{/g);
  if (arrayMatches) {
    console.log(`\n📄 ${f}:`);
    arrayMatches.forEach(m => console.log(`  ${m}`));
  }
});

