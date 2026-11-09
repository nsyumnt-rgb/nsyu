const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '../App/lib');

const suspicious = [
  'HDFC',
  '502000',
  'Jasola',
  '123, Main Road',
  'ABCDE1234F',
  'U72900',
  '8800123456',
  '8800503662',
  'Rahul',
  'Priya',
  'Amit Sharma',
  'Mohd Nazim',
  'mock',
  'dummy'
];

function scan(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      scan(full);
    } else if (f.name.endsWith('.dart')) {
      const content = fs.readFileSync(full, 'utf8');
      suspicious.forEach(s => {
        const regex = new RegExp(`\\b${s}\\b`, 'i');
        if (regex.test(content)) {
          const lines = content.split('\n');
          lines.forEach((l, idx) => {
            if (regex.test(l) && !l.trim().startsWith('//')) {
              console.log(`${path.relative(APP_DIR, full)}:L${idx+1} [${s}]: ${l.trim().slice(0, 100)}`);
            }
          });
        }
      });
    }
  }
}

scan(APP_DIR);

