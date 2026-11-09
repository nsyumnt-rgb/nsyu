const fs = require('fs');
const path = require('path');
const d = require('./db_audit_comprehensive_result.json');

const modelFiles = fs.readdirSync(path.resolve(__dirname, '../api/src/models')).filter(f => f.endsWith('.ts') && f !== 'index.ts');
const tableToModel = {};
for (const mf of modelFiles) {
  const content = fs.readFileSync(path.resolve(__dirname, '../api/src/models', mf), 'utf8');
  const m = content.match(/tableName:\s*['"]([^'"]+)['"]/);
  if (m) tableToModel[m[1]] = { file: 'api/src/models/' + mf, className: mf.replace('.ts', '') };
}

const tableUsage = {};

for (const t of d.tables) {
  const model = tableToModel[t.table];
  const refs = [];
  if (model) {
    refs.push(model.file);
  }

  function scanDir(dir) {
    const fullDir = path.resolve(__dirname, '..', dir);
    if (!fs.existsSync(fullDir)) return;
    for (const f of fs.readdirSync(fullDir, { withFileTypes: true })) {
      const full = path.join(fullDir, f.name);
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', 'build', '.dart_tool'].includes(f.name)) scanDir(path.relative(path.resolve(__dirname, '..'), full));
      } else if (f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.dart')) {
        const text = fs.readFileSync(full, 'utf8');
        let matched = false;
        let lineNo = 0;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("'" + t.table + "'") || line.includes('"' + t.table + '"') || (model && line.includes(model.className) && !full.includes('models/index.ts') && !full.includes('models/' + model.className + '.ts'))) {
            matched = true;
            lineNo = i + 1;
            break;
          }
        }
        if (matched) {
          const relPath = path.relative(path.resolve(__dirname, '..'), full).replace(/\\/g, '/');
          refs.push(relPath + ':' + lineNo);
        }
      }
    }
  }

  scanDir('api/src/controllers');
  scanDir('api/src/routes');
  scanDir('api/src/middleware');
  scanDir('api/src/utils');
  scanDir('web/src/pages');
  scanDir('web/src/api');
  scanDir('App/lib/screens');
  scanDir('App/lib/services');
  scanDir('App/lib/models');

  tableUsage[t.table] = {
    table: t.table,
    rowCount: t.rowCount,
    model: model ? model.className : null,
    inFKs: t.incomingFks,
    outFKs: t.outgoingFks,
    refs: refs.slice(0, 5)
  };
}

fs.writeFileSync(path.resolve(__dirname, 'accurate_table_usage.json'), JSON.stringify(tableUsage, null, 2));
console.log('Saved accurate_table_usage.json with exact code refs.');

