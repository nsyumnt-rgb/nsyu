// scripts/scan_for_fake_data.js
const fs = require('fs');
const path = require('path');

const keywords = [
  'Rahul Sharma', 'Priya Verma', 'Amit Kumar', 'Sneha Patel', 'Vikram Singh',
  'iPhone 15', 'Samsung Galaxy', 'AirPods', 'MacBook', 'OnePlus',
  '1245600', '820300', '1875400', '1284', '345600', '218900',
  'dummy', 'mock', 'fake', 'fallback', 'sample', 'hardcoded'
];

function scanDir(dir, extList) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build' && file !== '.dart_tool') {
        results = results.concat(scanDir(fullPath, extList));
      }
    } else {
      if (extList.includes(path.extname(file))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          for (const kw of keywords) {
            if (line.toLowerCase().includes(kw.toLowerCase())) {
              results.push({
                file: path.relative(process.cwd(), fullPath),
                line: idx + 1,
                keyword: kw,
                text: line.trim()
              });
              break;
            }
          }
        });
      }
    }
  }
  return results;
}

console.log('--- Scanning web/src for dummy/mock/fallback data ---');
const webResults = scanDir(path.resolve('web/src'), ['.ts', '.tsx']);
webResults.forEach(r => console.log(`${r.file}:${r.line} [${r.keyword}] -> ${r.text.slice(0, 100)}`));

console.log(`\nFound ${webResults.length} matches in web/src\n`);

console.log('--- Scanning App/lib for dummy/mock/fallback data ---');
const appResults = scanDir(path.resolve('App/lib'), ['.dart']);
appResults.forEach(r => console.log(`${r.file}:${r.line} [${r.keyword}] -> ${r.text.slice(0, 100)}`));

console.log(`\nFound ${appResults.length} matches in App/lib\n`);

