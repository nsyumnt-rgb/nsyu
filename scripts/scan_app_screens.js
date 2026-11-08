// scripts/scan_app_screens.js
const fs = require('fs');
const path = require('path');

const screensDir = path.resolve('App/lib/screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.dart'));

for (const file of files) {
  const content = fs.readFileSync(path.join(screensDir, file), 'utf8');
  const lines = content.split('\n');
  const susp = [];
  lines.forEach((l, idx) => {
    const lower = l.toLowerCase();
    if (lower.includes('mock') || lower.includes('dummy') || lower.includes('sample') || lower.includes('fake') || lower.includes('hardcoded')) {
      susp.push({ line: idx + 1, text: l.trim() });
    }
    // Also look for hardcoded names in strings
    if (l.includes('Rahul') || l.includes('Amit') || l.includes('Suresh') || l.includes('Priya') || l.includes('iPhone')) {
      if (!l.includes('author') && !l.includes('//')) {
        susp.push({ line: idx + 1, text: l.trim() });
      }
    }
  });
  if (susp.length > 0) {
    console.log(`\n=== App/lib/screens/${file} ===`);
    susp.forEach(s => console.log(`  Line ${s.line}: ${s.text.slice(0, 100)}`));
  }
}

