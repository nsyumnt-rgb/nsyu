const fs = require('fs');
const path = require('path');

const SCREENS_DIR = path.resolve(__dirname, '../App/lib/screens');
const files = fs.readdirSync(SCREENS_DIR);

files.forEach(file => {
  if (!file.endsWith('.dart')) return;
  const content = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8');
  const lines = content.split('\n');

  lines.forEach((l, idx) => {
    // Look for suspicious hardcoded things:
    // e.g. badge with static '1', '2', '3'
    if (/\bchild:\s*(?:const\s+)?Text\s*\(\s*['"][0-9]+['"]/.test(l)) {
      console.log(`${file}:L${idx+1} -> ${l.trim()}`);
    }
    // Look for static fallback numbers e.g. > 0 ? ... : 21
    if (/\?\s*[a-zA-Z0-9_.]+\s*:\s*[0-9]+/.test(l) && !l.includes('0') && !l.includes('1') && !l.includes('100')) {
      console.log(`${file}:L${idx+1} [ternary number] -> ${l.trim()}`);
    }
  });
});

