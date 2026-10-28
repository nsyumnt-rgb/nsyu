import { sequelize } from "../models";

async function run() {
  console.log("=== ALL SEQUELIZE MODELS AND TABLES ===");
  for (const [name, model] of Object.entries(sequelize.models)) {
    const tableName = (model as any).tableName;
    try {
      const [countResult]: any = await sequelize.query(`SELECT COUNT(*)::int AS count FROM "${tableName}";`);
      const count = countResult[0].count;
      const [cols]: any = await sequelize.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position;
      `);
      console.log(`Model: ${name.padEnd(22)} Table: ${tableName.padEnd(24)} Rows: ${String(count).padStart(5)}`);
      const colNames = cols.map((c: any) => c.column_name);
      console.log(`   Columns: ${colNames.join(", ")}`);
    } catch (err: any) {
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
