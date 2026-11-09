const fs = require('fs');
const path = require('path');
const { sequelize } = require('../api/dist/config/database');

(async () => {
  console.log('🚀 Running Migration 01: Unified Schema, Enums, Super Admin & RLS...');
  const sqlPath = path.join(__dirname, '../api/src/migrations/01_unified_schema_and_super_admin.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    // Split SQL by statements or run directly
    await sequelize.query(sql);
    console.log('✔ Migration 01 executed successfully!');

    // Verification queries
    const [shopStatusEnum] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'enum_shops_status'
    `);
    console.log('✔ enum_shops_status values:', shopStatusEnum.map(r => r.enumlabel));

    const [superAdminOwner] = await sequelize.query(`
      SELECT id, name, email, is_super_admin, role, status FROM public.owners WHERE email = 'superadmin@nsyu.com'
    `);
    console.log('✔ Super Admin Owner record:', superAdminOwner);

    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('platform_audit_log', 'status_history')
    `);
    console.log('✔ Newly created tables:', tables.map(r => r.table_name));

    const [policies] = await sequelize.query(`
      SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public'
    `);
    console.log(`✔ RLS Policies created (${policies.length} total):`, policies.map(p => `${p.tablename}: ${p.policyname} (${p.cmd})`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();

