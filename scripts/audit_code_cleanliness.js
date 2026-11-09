const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SEARCH_DIRS = ['web/src', 'api/src', 'App/lib'];
const IGNORE_PATTERNS = ['node_modules', '.git', 'dist', 'build', '.dart_tool'];

const PATTERNS = [
  { name: 'mock_var', regex: /\b(mock[A-Z0-9_]+|dummy[A-Z0-9_]+|fake[A-Z0-9_]+)\b/gi },
  { name: 'mock_data', regex: /\b(mockData|dummyData|fakeData|testData|sampleData)\b/gi },
  { name: 'fallback_mock_array', regex: /(\|\||\?\?)\s*\[\s*\{/g },
  { name: 'fake_person_name', regex: /\b(Rahul Sharma|Priya Verma|Mohd Nazim|Amit Sharma|Ramesh Kumar|Suresh Mobile)\b/gi },
  { name: 'hardcoded_phone', regex: /\b(8800123456|9876543210)\b/g }
];

const results = [];

function scanFile(filePath) {
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.dart'].includes(ext)) return;
  if (filePath.includes('.test.') || filePath.includes('.spec.')) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // skip comments if purely comment
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

    for (const pat of PATTERNS) {
      if (pat.regex.test(line)) {
        results.push({
          file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
          line: idx + 1,
          pattern: pat.name,
          text: trimmed
        });
        // reset regex state
        pat.regex.lastIndex = 0;
      }
    }
  });
}

function walkDir(dir) {
  const fullPath = path.join(ROOT_DIR, dir);
  if (!fs.existsSync(fullPath)) return;

  function traverse(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_PATTERNS.includes(entry.name)) continue;
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        traverse(entryPath);
      } else {
        scanFile(entryPath);
      }
    }
  }

  traverse(fullPath);
}

for (const dir of SEARCH_DIRS) {
  walkDir(dir);
}

console.log(`Scan completed. Found ${results.length} matches:`);
const grouped = {};
results.forEach(r => {
  grouped[r.file] = grouped[r.file] || [];
  grouped[r.file].push(r);
});

for (const [file, items] of Object.entries(grouped)) {
  console.log(`\n📄 ${file} (${items.length} items):`);
  items.slice(0, 10).forEach(i => console.log(`  L${i.line} [${i.pattern}]: ${i.text}`));
  if (items.length > 10) console.log(`  ... and ${items.length - 10} more`);
}

fs.writeFileSync(path.join(__dirname, 'code_cleanliness_audit.json'), JSON.stringify(results, null, 2));

