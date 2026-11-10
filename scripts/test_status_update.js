const http = require('http');

function post(urlStr, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, raw: d });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function put(urlStr, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, raw: d });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(urlStr, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, raw: d });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log("1. Logging in...");
  const loginRes = await post('http://localhost:5000/api/auth/login', {
    email: 'nsyu.mnt@gmail.com',
    password: 'Password@123'
  });
  console.log("Login status:", loginRes.status);
  const token = loginRes.body?.data?.accessToken || loginRes.body?.data?.tokens?.accessToken;
  if (!token) {
    console.error("No token!", loginRes.body);
    return;
  }

  console.log("2. Fetching orders...");
  const ordersRes = await get('http://localhost:5000/api/orders', token);
  console.log("Orders count:", ordersRes.body?.data?.orders?.length || ordersRes.body?.data?.length || 0);
  let order = ordersRes.body?.data?.orders?.[0] || ordersRes.body?.data?.[0];

  if (!order) {
    console.log("Creating an order to test...");
    const createRes = await post('http://localhost:5000/api/orders', {
      customerId: 1,
      items: [{ productId: 184, quantity: 2, rate: 150 }]
    }, token);
    console.log("Create order status:", createRes.status, createRes.body);
    order = createRes.body?.data;
  }

  if (order) {
    console.log("Testing update order status for order ID:", order.id, "current status:", order.status);
    const targetStatus = order.status === 'confirmed' ? 'processing' : 'confirmed';
    const updateRes = await put(`http://localhost:5000/api/orders/${order.id}/status`, {
      status: targetStatus,
      force: true
    }, token);
    console.log(`Update to ${targetStatus} result:`, updateRes.status, updateRes.body);

    // Also test updating by order_number
    if (order.order_number) {
      console.log("Testing update by order_number:", order.order_number);
      const updateByNum = await put(`http://localhost:5000/api/orders/${order.order_number}/status`, {
        status: order.status,
        force: true
      }, token);
      console.log("Update by order_number result:", updateByNum.status, updateByNum.body);
    }
  }

  console.log("3. Fetching sales / bills...");
  const salesRes = await get('http://localhost:5000/api/sales', token);
  console.log("Sales count:", salesRes.body?.data?.sales?.length || salesRes.body?.data?.length || 0);
  let sale = salesRes.body?.data?.sales?.[0] || salesRes.body?.data?.[0];

  if (!sale) {
    console.log("Creating a sale to test...");
    const createSaleRes = await post('http://localhost:5000/api/sales', {
      customerId: 1,
      items: [{ productId: 184, quantity: 1, rate: 150 }],
      paymentMethod: 'cash',
      paidAmount: 0
    }, token);
    console.log("Create sale status:", createSaleRes.status, createSaleRes.body);
    sale = createSaleRes.body?.data;
  }

  if (sale) {
    console.log("Testing update sale status for sale ID:", sale.id, "invoice:", sale.invoice_number, "current status:", sale.status);
    const targetStatus = sale.status === 'paid' ? 'unpaid' : 'paid';
    const updateSaleRes = await put(`http://localhost:5000/api/sales/${sale.id}`, {
      status: targetStatus
    }, token);
    console.log(`Update sale ${sale.id} to ${targetStatus} result:`, updateSaleRes.status, updateSaleRes.body);

    if (sale.invoice_number) {
      console.log("Testing update sale by invoice_number:", sale.invoice_number);
      const updateSaleByNum = await put(`http://localhost:5000/api/sales/${sale.invoice_number}`, {
        status: sale.status
      }, token);
      console.log("Update by invoice_number result:", updateSaleByNum.status, updateSaleByNum.body);
    }
  }
}

run().catch(console.error);
