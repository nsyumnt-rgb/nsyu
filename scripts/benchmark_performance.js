const API_URL = 'https://nsyu-backend-api.onrender.com/api';

async function runBenchmark() {
  console.log('=== Benchmarking API Performance Metrics ===');

  const tLogin = Date.now();
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nsyu.mnt@gmail.com', password: 'Password@123' })
  });
  const loginDuration = Date.now() - tLogin;
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const headers = { 'Authorization': `Bearer ${token}` };

  console.log(`Login Endpoint (/auth/login): ${loginDuration}ms (HTTP ${loginRes.status})`);

  const tests = [
    { name: 'Reports (Sales)', path: '/reports/sales' },
    { name: 'Reports (Inventory)', path: '/reports/inventory' },
    { name: 'Bills / Sales List', path: '/sales?limit=20' },
    { name: 'Orders List', path: '/orders?limit=20' },
    { name: 'Order Stats', path: '/orders/stats' },
    { name: 'Products / Catalog', path: '/products?limit=20' },
    { name: 'Customers List', path: '/customers?limit=20' },
    { name: 'Ledger Outstanding', path: '/ledger/outstanding' },
    { name: 'Notifications List', path: '/notifications?limit=20' },
    { name: 'Notifications Unread', path: '/notifications/unread-count' }
  ];

  const results = [];
  for (const t of tests) {
    const t0 = Date.now();
    const res = await fetch(`${API_URL}${t.path}`, { headers });
    const duration = Date.now() - t0;
    console.log(`${t.name.padEnd(26)}: ${duration}ms (HTTP ${res.status})`);
    results.push({ name: t.name, path: t.path, duration, status: res.status });
  }

  return { loginDuration, results };
}

runBenchmark().catch(console.error);

