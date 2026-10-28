import sequelize from "../config/database";
import { formatTimeKey } from "../utils/referenceCode";

async function run() {
  console.log("=== STARTING REFERENCE CODES MIGRATION AND BACKFILL ===");

  // 1. Create reference_counters table
  console.log("1. Creating reference_counters table...");
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS reference_counters (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      scope VARCHAR(50) NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_reference_counters_owner_scope UNIQUE (owner_id, scope)
    );
  `);
  console.log("   ✓ reference_counters table ready");

  // 2. Add reference_code column to all entities
  const tables = [
    { name: "owners", prefix: "OWN", isDateBased: false },
    { name: "shops", prefix: "SHP", isDateBased: false },
    { name: "employees", prefix: "EMP", isDateBased: false },
    { name: "customers", prefix: "CUS", isDateBased: false },
    { name: "suppliers", prefix: "SUP", isDateBased: false },
    { name: "products", prefix: "PRD", isDateBased: false },
    { name: "categories", prefix: "CAT", isDateBased: false },
    { name: "subcategories", prefix: "SUB", isDateBased: false },
    { name: "sales", prefix: "INV", isDateBased: true },
    { name: "orders", prefix: "ORD", isDateBased: true },
    { name: "payments", prefix: "PAY", isDateBased: true },
    { name: "purchases", prefix: "PUR", isDateBased: true },
    { name: "stock_transfers", prefix: "TRF", isDateBased: true },
    { name: "inventory_transactions", prefix: "STM", isDateBased: true },
    { name: "customer_ledger", prefix: "CLG", isDateBased: true },
    { name: "supplier_ledger", prefix: "SLG", isDateBased: true },
    { name: "employee_ledger", prefix: "ELG", isDateBased: true },
    { name: "attendance", prefix: "ATT", isDateBased: true },
    { name: "payrolls", prefix: "PRL", isDateBased: true },
    { name: "emi_plans", prefix: "EMI", isDateBased: true },
    { name: "sale_returns", prefix: "SRT", isDateBased: true },
    { name: "purchase_returns", prefix: "PRT", isDateBased: true },
  ];

  console.log("2. Adding reference_code columns and indexes...");
  for (const t of tables) {
    try {
      await sequelize.query(`ALTER TABLE "${t.name}" ADD COLUMN IF NOT EXISTS reference_code VARCHAR(50);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS "idx_${t.name}_reference_code" ON "${t.name}" (reference_code);`);
      console.log(`   ✓ ${t.name}: reference_code column and index ready`);
    } catch (err: any) {
      console.error(`   ✗ Error on ${t.name}: ${err.message}`);
    }
  }

  // 3. Backfill entity tables (deterministic OWN-000001, etc.)
  console.log("3. Backfilling entity tables...");
  for (const t of tables.filter((x) => !x.isDateBased)) {
    const [rows]: any = await sequelize.query(`
      SELECT id, owner_id FROM "${t.name}" WHERE reference_code IS NULL OR reference_code = '' ORDER BY id ASC;
    `).catch(() => {
      // owners table may not have owner_id column (owners.id is the owner)
      return sequelize.query(`SELECT id, id as owner_id FROM "${t.name}" WHERE reference_code IS NULL OR reference_code = '' ORDER BY id ASC;`);
    });

    for (const r of rows) {
      const code = `${t.prefix}-${String(r.id).padStart(6, "0")}`;
      await sequelize.query(`UPDATE "${t.name}" SET reference_code = :code WHERE id = :id;`, {
        replacements: { code, id: r.id },
      });
    }

    // Set counter to MAX(id)
    const [maxResult]: any = await sequelize.query(`
      SELECT COALESCE(MAX(id), 0) AS max_id, COALESCE(${t.name === "owners" ? "id" : "owner_id"}, 1) as owner_id
      FROM "${t.name}"
      GROUP BY ${t.name === "owners" ? "id" : "owner_id"};
    `);

    for (const m of maxResult) {
      const ownerId = m.owner_id || 1;
      const maxId = Number(m.max_id);
      const scope = `ENTITY_${t.prefix}`;
      await sequelize.query(`
        INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
        VALUES (:ownerId, :scope, :maxId, NOW(), NOW())
        ON CONFLICT (owner_id, scope)
        DO UPDATE SET last_number = GREATEST(reference_counters.last_number, :maxId), updated_at = NOW();
      `, { replacements: { ownerId, scope, maxId } });
    }

    console.log(`   ✓ ${t.name}: Backfilled ${rows.length} rows`);
  }

  // 4. Backfill transaction tables (deterministic <PREFIX><YYMMDDHHmm><0001>)
  console.log("4. Backfilling transaction tables...");
  for (const t of tables.filter((x) => x.isDateBased)) {
    const [rows]: any = await sequelize.query(`
      SELECT id, owner_id, created_at FROM "${t.name}"
      WHERE reference_code IS NULL OR reference_code = ''
      ORDER BY created_at ASC, id ASC;
    `);

    const minuteGroups: Record<string, number> = {};

    for (const r of rows) {
      const ownerId = r.owner_id || 1;
      const createdAt = r.created_at ? new Date(r.created_at) : new Date();
      const timeKey = formatTimeKey(createdAt);
      const groupKey = `${ownerId}_${t.prefix}${timeKey}`;

      minuteGroups[groupKey] = (minuteGroups[groupKey] || 0) + 1;
      const seqStr = String(minuteGroups[groupKey]).padStart(4, "0");
      const code = `${t.prefix}${timeKey}${seqStr}`;

      await sequelize.query(`UPDATE "${t.name}" SET reference_code = :code WHERE id = :id;`, {
        replacements: { code, id: r.id },
      });
    }

    // Sync counters with the assigned sequence numbers
    for (const [groupKey, count] of Object.entries(minuteGroups)) {
      const [ownerIdStr, scope] = groupKey.split("_");
      const ownerId = Number(ownerIdStr);
      await sequelize.query(`
        INSERT INTO reference_counters (owner_id, scope, last_number, created_at, updated_at)
        VALUES (:ownerId, :scope, :count, NOW(), NOW())
        ON CONFLICT (owner_id, scope)
        DO UPDATE SET last_number = GREATEST(reference_counters.last_number, :count), updated_at = NOW();
      `, { replacements: { ownerId, scope, count } });
    }

    console.log(`   ✓ ${t.name}: Backfilled ${rows.length} rows`);
  }

  // 5. Verification Audit
  console.log("\n=== VERIFICATION AUDIT OF REFERENCE CODES ===");
  for (const t of tables) {
    const [countRes]: any = await sequelize.query(`SELECT COUNT(*)::int as total, COUNT(reference_code)::int as with_code FROM "${t.name}";`);
    const [sample]: any = await sequelize.query(`SELECT id, reference_code FROM "${t.name}" LIMIT 2;`);
    const samples = sample.map((s: any) => `id=${s.id} -> ${s.reference_code}`).join(", ");
    console.log(`${t.name.padEnd(24)} | Total: ${String(countRes[0].total).padStart(4)} | With Code: ${String(countRes[0].with_code).padStart(4)} | Samples: ${samples}`);
  }

  console.log("\n=== MIGRATION AND BACKFILL COMPLETED SUCCESSFULLY ===");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
