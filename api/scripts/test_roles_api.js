const API_URL = 'https://nsyu-backend-api.onrender.com/api';

const accounts = [
  { role: 'Owner', email: 'nsyu.mnt@gmail.com', password: 'Password@123' },
  { role: 'Super Admin', email: 'superadmin@nsyu.com', password: 'Password@123' },
  { role: 'Admin', email: 'admin@nsyu.com', password: 'Password@123' },
  { role: 'Staff', email: 'staff@nsyu.com', password: 'Password@123' },
  { role: 'User', email: 'user@nsyu.com', password: 'Password@123' },
];

async function testAll() {
  console.log('Testing live API login & RBAC /auth/me for each role:');
  console.log('API Target:', API_URL);

  for (const acc of accounts) {
    console.log(`\n==============================================`);
    console.log(`[Role: ${acc.role}] Email: ${acc.email}`);
    
    // 1. Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: acc.password })
    });
    const loginData = await loginRes.json();
    
    if (!loginRes.ok || !loginData.success) {
      console.error(`❌ Login failed:`, loginData);
      continue;
    }
    
    console.log(`✔ Login SUCCESS! AccountType: ${loginData.data.accountType}`);
    const token = loginData.data.accessToken;

    // 2. /auth/me
    const meRes = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();
    
    if (!meRes.ok || !meData.success) {
      console.error(`❌ /auth/me failed:`, meData);
      continue;
    }

    const { roleName, shopId, permissions, fieldPermissions } = meData.data;
    console.log(`✔ /auth/me SUCCESS! RoleName: ${roleName}, ShopID: ${shopId}`);
    
    // Sample permissions
    const modulesToCheck = ['products', 'billing', 'orders', 'reports', 'user_management', 'system_settings'];
    console.log(`  Module Permissions summary:`);
    modulesToCheck.forEach(m => {
      const p = permissions[m] || { can_view: false, can_create: false };
      console.log(`    - ${m.padEnd(16)}: view=${p.can_view}, create=${p.can_create}, edit=${p.can_edit}, delete=${p.can_delete}`);
    });
  }
}

testAll().catch(console.error);
