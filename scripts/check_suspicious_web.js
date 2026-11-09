const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../web/src');

const suspicious = [
  'HDFC',
  '502000',
  'Jasola',
  '123, Main Road',
  'ABCDE1234F',
  'U72900',
  '8800503662',
  '07 - Delhi',
  'Rahul',
  'Priya',
  'Amit Sharma',
  'Mohd Nazim'
];

function scan(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      scan(full);
    } else if (f.name.endsWith('.tsx') || f.name.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      suspicious.forEach(s => {
        if (content.includes(s)) {
          console.log(`Match '${s}' in ${path.relative(SRC_DIR, full)}`);
        }
      });
    }
  }
}

scan(SRC_DIR);

