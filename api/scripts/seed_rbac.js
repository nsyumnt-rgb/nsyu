const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME || 'postgres', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

const MODULES_DATA = [
  { code: 'all_shops', name: 'All Shops', description: 'Manage all registered shops/businesses', icon: 'Store', sort_order: 1 },
  { code: 'shop_settings', name: 'Shop Settings', description: 'Manage own shop and business settings', icon: 'Settings', sort_order: 2 },
  { code: 'user_management', name: 'User Management', description: 'Manage all users and business owners', icon: 'Users', sort_order: 3 },
  { code: 'role_permissions', name: 'Role & Permissions', description: 'Module-wise permission management', icon: 'ShieldCheck', sort_order: 4 },
  { code: 'products', name: 'Products', description: 'Product catalog, items, prices and stock visibility', icon: 'Package', sort_order: 5 },
  { code: 'stock_management', name: 'Stock Management', description: 'Stock and inventory management', icon: 'Boxes', sort_order: 6 },
  { code: 'billing', name: 'Billing', description: 'Billing and invoicing', icon: 'Receipt', sort_order: 7 },
  { code: 'sales_purchases', name: 'Sales & Purchases', description: 'Sales and purchase management', icon: 'TrendingUp', sort_order: 8 },
  { code: 'customers', name: 'Customers', description: 'Customer and ledger management', icon: 'UserCheck', sort_order: 9 },
  { code: 'orders', name: 'Orders', description: 'Customer and sales orders, cart and tracking', icon: 'ShoppingCart', sort_order: 10 },
  { code: 'accounts_expenses', name: 'Accounts & Expenses', description: 'Accounts and expenses', icon: 'CreditCard', sort_order: 11 },
  { code: 'reports', name: 'Reports', description: 'Reports and analytics', icon: 'BarChart3', sort_order: 12 },
  { code: 'subscriptions', name: 'Subscriptions', description: 'Manage subscriptions and plans', icon: 'Sparkles', sort_order: 13 },
  { code: 'system_settings', name: 'System Settings', description: 'System settings and global configurations', icon: 'Sliders', sort_order: 14 }
];

const ROLES_DATA = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'System Management – Full system control across all shops and global configurations',
    is_system: true
  },
  {
    code: 'owner',
    name: 'Owner',
    description: 'Full Shop Access – Full business control of own shop and operations',
    is_system: true
  },
  {
    code: 'staff',
    name: 'Staff',
    description: 'Daily Operations – Limited operational access to products, stock, billing, sales, customers, and orders',
    is_system: true
  },
  {
    code: 'user',
    name: 'User',
    description: 'Customer Portal – Customer access to browse products, place orders, and view order history',
    is_system: true
  }
];

// Matrix mapping according to user specification
// ✓ = full access (view, create, edit, delete)
// ✓* = assigned / self scoped
// — = no access
const MATRIX = {
  super_admin: {
    scope: 'all',
    modules: {
      all_shops: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      shop_settings: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      user_management: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      role_permissions: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      products: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      stock_management: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      billing: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      sales_purchases: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      customers: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      orders: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      accounts_expenses: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      reports: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      subscriptions: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      system_settings: { can_view: true, can_create: true, can_edit: true, can_delete: true }
    }
  },
  owner: {
    scope: 'shop',
    modules: {
      all_shops: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      shop_settings: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      user_management: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      role_permissions: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      products: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      stock_management: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      billing: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      sales_purchases: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      customers: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      orders: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      accounts_expenses: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      reports: { can_view: true, can_create: true, can_edit: true, can_delete: true },
      subscriptions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      system_settings: { can_view: false, can_create: false, can_edit: false, can_delete: false }
    }
  },
  staff: {
    scope: 'shop',
    modules: {
      all_shops: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      shop_settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      user_management: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      role_permissions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      products: { can_view: true, can_create: false, can_edit: false, can_delete: false },
      stock_management: { can_view: true, can_create: false, can_edit: false, can_delete: false },
      billing: { can_view: true, can_create: true, can_edit: false, can_delete: false },
      sales_purchases: { can_view: true, can_create: true, can_edit: false, can_delete: false },
      customers: { can_view: true, can_create: true, can_edit: false, can_delete: false },
      orders: { can_view: true, can_create: true, can_edit: false, can_delete: false },
      accounts_expenses: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      reports: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      subscriptions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      system_settings: { can_view: false, can_create: false, can_edit: false, can_delete: false }
    }
  },
  user: {
    scope: 'self',
    modules: {
      all_shops: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      shop_settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      user_management: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      role_permissions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      products: { can_view: true, can_create: false, can_edit: false, can_delete: false },
      stock_management: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      billing: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      sales_purchases: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      customers: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      orders: { can_view: true, can_create: true, can_edit: false, can_delete: false },
      accounts_expenses: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      reports: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      subscriptions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
      system_settings: { can_view: false, can_create: false, can_edit: false, can_delete: false }
    }
  }
};

async function seed() {
  await sequelize.authenticate();
  console.log('Connected to Supabase PostgreSQL!');

  const t = await sequelize.transaction();
  try {
    // 1. Insert or update modules
    console.log('Upserting 14 modules...');
    const moduleMap = {};
    for (const m of MODULES_DATA) {
      const [existing] = await sequelize.query(
        'SELECT id FROM modules WHERE code = :code',
        { replacements: { code: m.code }, transaction: t }
      );
      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE modules SET name = :name, description = :description, icon = :icon, sort_order = :sort_order, updated_at = NOW() WHERE code = :code`,
          { replacements: m, transaction: t }
        );
        moduleMap[m.code] = existing[0].id;
      } else {
        const [[inserted]] = await sequelize.query(
          `INSERT INTO modules (code, name, description, icon, sort_order, is_active, created_at, updated_at)
           VALUES (:code, :name, :description, :icon, :sort_order, true, NOW(), NOW()) RETURNING id`,
          { replacements: m, transaction: t }
        );
        moduleMap[m.code] = inserted.id;
      }
    }
    console.log('Modules registered:', Object.keys(moduleMap).length);

    // 2. Insert standard actions into permissions table
    console.log('Populating permissions table...');
    const actions = ['view', 'create', 'edit', 'delete'];
    for (const m of MODULES_DATA) {
      for (const act of actions) {
        const permCode = `${m.code}.${act}`;
        const permName = `${act.charAt(0).toUpperCase() + act.slice(1)} ${m.name}`;
        const [existing] = await sequelize.query(
          'SELECT id FROM permissions WHERE code = :code',
          { replacements: { code: permCode }, transaction: t }
        );
        if (existing.length === 0) {
          await sequelize.query(
            `INSERT INTO permissions (module_id, module_code, code, action, name, description, created_at, updated_at)
             VALUES (:module_id, :module_code, :code, :action, :name, :description, NOW(), NOW())`,
            {
              replacements: {
                module_id: moduleMap[m.code],
                module_code: m.code,
                code: permCode,
                action: act,
                name: permName,
                description: `Allows user to ${act} in ${m.name}`
              },
              transaction: t
            }
          );
        }
      }
    }

    // 3. Insert or update 4 User Roles
    console.log('Upserting 4 system roles...');
    const roleMap = {};
    for (const r of ROLES_DATA) {
      const [existing] = await sequelize.query(
        'SELECT id FROM roles WHERE code = :code OR name = :name',
        { replacements: { code: r.code, name: r.name }, transaction: t }
      );
      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE roles SET name = :name, code = :code, description = :description, is_system = :is_system, updated_at = NOW() WHERE id = :id`,
          { replacements: { ...r, id: existing[0].id }, transaction: t }
        );
        roleMap[r.code] = existing[0].id;
      } else {
        const [[inserted]] = await sequelize.query(
          `INSERT INTO roles (name, code, description, is_system, created_at, updated_at)
           VALUES (:name, :code, :description, :is_system, NOW(), NOW()) RETURNING id`,
          { replacements: r, transaction: t }
        );
        roleMap[r.code] = inserted.id;
      }
    }
    console.log('Roles registered:', roleMap);

    // 4. Populate role_permissions matrix
    console.log('Populating role_permissions matrix...');
    for (const roleCode of Object.keys(MATRIX)) {
      const roleId = roleMap[roleCode];
      const roleConfig = MATRIX[roleCode];
      for (const moduleCode of Object.keys(roleConfig.modules)) {
        const perms = roleConfig.modules[moduleCode];
        const moduleId = moduleMap[moduleCode];

        const [existing] = await sequelize.query(
          'SELECT id FROM role_permissions WHERE role_id = :role_id AND (module = :module OR module_id = :module_id)',
          { replacements: { role_id: roleId, module: moduleCode, module_id: moduleId }, transaction: t }
        );

        if (existing.length > 0) {
          await sequelize.query(
            `UPDATE role_permissions 
             SET module = :module, module_id = :module_id, can_view = :can_view, can_create = :can_create, 
                 can_edit = :can_edit, can_delete = :can_delete, scope = :scope, updated_at = NOW()
             WHERE id = :id`,
            {
              replacements: {
                id: existing[0].id,
                module: moduleCode,
                module_id: moduleId,
                ...perms,
                scope: roleCode === 'user' && moduleCode === 'orders' ? 'self' : roleConfig.scope
              },
              transaction: t
            }
          );
        } else {
          await sequelize.query(
            `INSERT INTO role_permissions (role_id, module_id, module, can_view, can_create, can_edit, can_delete, scope, created_at, updated_at)
             VALUES (:role_id, :module_id, :module, :can_view, :can_create, :can_edit, :can_delete, :scope, NOW(), NOW())`,
            {
              replacements: {
                role_id: roleId,
                module_id: moduleId,
                module: moduleCode,
                ...perms,
                scope: roleCode === 'user' && moduleCode === 'orders' ? 'self' : roleConfig.scope
              },
              transaction: t
            }
          );
        }
      }
    }

    // 5. Populate shop_modules for existing shops
    console.log('Configuring shop_modules for registered shops...');
    const [shops] = await sequelize.query('SELECT id FROM shops', { transaction: t });
    // All modules except super_admin-only modules (subscriptions, system_settings, all_shops) are available per shop
    const shopAllowedModules = MODULES_DATA.filter(m => !['all_shops', 'subscriptions', 'system_settings'].includes(m.code));
    for (const shop of shops) {
      for (const sm of shopAllowedModules) {
        const moduleId = moduleMap[sm.code];
        const [existing] = await sequelize.query(
          'SELECT id FROM shop_modules WHERE shop_id = :shop_id AND module_id = :module_id',
          { replacements: { shop_id: shop.id, module_id: moduleId }, transaction: t }
        );
        if (existing.length === 0) {
          await sequelize.query(
            `INSERT INTO shop_modules (shop_id, module_id, module_code, is_enabled, created_at, updated_at)
             VALUES (:shop_id, :module_id, :module_code, true, NOW(), NOW())`,
            { replacements: { shop_id: shop.id, module_id: moduleId, module_code: sm.code }, transaction: t }
          );
        }
      }
    }

    // 6. Assign Owner NSYU (id 1) to user_roles
    console.log('Assigning user_roles for owner...');
    const [owners] = await sequelize.query('SELECT id FROM owners', { transaction: t });
    for (const owner of owners) {
      const [existing] = await sequelize.query(
        'SELECT id FROM user_roles WHERE user_type = :user_type AND user_id = :user_id AND role_id = :role_id',
        { replacements: { user_type: 'owner', user_id: owner.id, role_id: roleMap['owner'] }, transaction: t }
      );
      if (existing.length === 0) {
        await sequelize.query(
          `INSERT INTO user_roles (user_type, user_id, role_id, is_active, created_at, updated_at)
           VALUES ('owner', :user_id, :role_id, true, NOW(), NOW())`,
          { replacements: { user_id: owner.id, role_id: roleMap['owner'] }, transaction: t }
        );
      }
    }

    await t.commit();
    console.log('All 4 Roles, 14 Modules, Matrix Permissions, and Shop Modules seeded successfully!');
  } catch (error) {
    await t.rollback();
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();

