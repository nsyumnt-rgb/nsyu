const path = require('path');
const inv = require(path.join(__dirname, 'detailed_live_db_inventory.json'));
console.table(inv.tables.map(t => ({ table: t.table, rowCount: t.rowCount })));
