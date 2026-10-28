"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
async function run() {
    console.log("=== ALL SEQUELIZE MODELS AND TABLES ===");
    for (const [name, model] of Object.entries(models_1.sequelize.models)) {
        const tableName = model.tableName;
        try {
            const [countResult] = await models_1.sequelize.query(`SELECT COUNT(*)::int AS count FROM "${tableName}";`);
            const count = countResult[0].count;
            const [cols] = await models_1.sequelize.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position;
      `);
            console.log(`Model: ${name.padEnd(22)} Table: ${tableName.padEnd(24)} Rows: ${String(count).padStart(5)}`);
            const colNames = cols.map((c) => c.column_name);
            console.log(`   Columns: ${colNames.join(", ")}`);
        }
        catch (err) {
            console.log(`Model: ${name.padEnd(22)} Table: ${tableName.padEnd(24)} ERROR: ${err.message}`);
        }
    }
}
run()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=audit_tables.js.map