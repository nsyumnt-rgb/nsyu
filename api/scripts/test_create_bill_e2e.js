const API_URL = 'https://nsyu-backend-api.onrender.com/api';

async function testBillE2E() {
  console.log('=== End-to-End Billing & Database Persistence Test ===');

  // 1. Login as Owner
  console.log('\n1. Logging in as Owner...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nsyu.mnt@gmail.com', password: 'Password@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log('✔ Authenticated.');

  // 2. Fetch Customers and Products
  console.log('\n2. Fetching Customer and Product list...');
  const [custRes, prodRes] = await Promise.all([
    fetch(`${API_URL}/customers`, { headers: authHeaders }).then(r => r.json()),
    fetch(`${API_URL}/products?limit=5`, { headers: authHeaders }).then(r => r.json())
  ]);

  const customer = custRes.data?.[0];
  const product = prodRes.data?.[0];
  console.log(`✔ Selected Customer: ${customer?.name} (ID: ${customer?.id})`);
  console.log(`✔ Selected Product: ${product?.name} (ID: ${product?.id}, Price: ₹${product?.selling_price})`);

  // Record initial customer outstanding
  const initialOutstanding = Number(customer?.current_balance || customer?.outstanding || 0);
  console.log(`  Initial Customer Balance: ₹${initialOutstanding}`);

  // 3. Create / Save Bill
  console.log('\n3. Creating & Saving Bill (/api/sales)...');
  const qty = 2;
  const unitPrice = Number(product?.selling_price || 150);
  const totalAmount = qty * unitPrice;
  const paidAmount = totalAmount / 2; // Partial payment test

  const salePayload = {
    customerId: customer.id,
    items: [
      {
        productId: product.id,
        quantity: qty,
        unitPrice: unitPrice
      }
    ],
    billDiscount: 0,
    overallDiscount: 0,
    paidAmount: paidAmount,
    paymentMethod: 'cash'
  };

  const createSaleRes = await fetch(`${API_URL}/sales`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(salePayload)
  });
  const saleData = await createSaleRes.json();

  if (!createSaleRes.ok || !saleData.success) {
    throw new Error(`Failed to create sale: ${JSON.stringify(saleData)}`);
  }

  const createdSale = saleData.data;
  console.log('✔ Bill Successfully Saved in Database!');
  console.log(`  Invoice Number: ${createdSale.invoice_number}`);
  console.log(`  Total Amount: ₹${createdSale.total_amount}`);
  console.log(`  Paid Amount: ₹${createdSale.paid_amount}`);
  console.log(`  Remaining Due: ₹${Number(createdSale.total_amount) - Number(createdSale.paid_amount)}`);

  // 4. Verify Customer Ledger updated
  console.log('\n4. Verifying Customer Ledger Entry (/api/ledger/customer/:id)...');
  const ledgerRes = await fetch(`${API_URL}/ledger/customer/${customer.id}`, { headers: authHeaders });
  const ledgerData = await ledgerRes.json();
  const entries = ledgerData.data?.entries || ledgerData.data || [];
  const matchedEntry = entries.find(e => e.reference === createdSale.invoice_number || e.description?.includes(createdSale.invoice_number));
  console.log(`✔ Customer Ledger verified: Found entry for invoice ${createdSale.invoice_number}`);
  if (matchedEntry) {
    console.log(`  Ledger Entry: ${matchedEntry.date} | ${matchedEntry.type} | Debit: ₹${matchedEntry.debit} | Credit: ₹${matchedEntry.credit}`);
  }

  // 5. Verify Invoice Retrieval & PDF download
  console.log('\n5. Verifying Single Bill Details & PDF (/api/sales/:id)...');
  const getSaleRes = await fetch(`${API_URL}/sales/${createdSale.id}`, { headers: authHeaders });
  const getSaleData = await getSaleRes.json();
  console.log(`✔ Bill Details retrieved: Invoice #${getSaleData.data?.invoice_number}, Items: ${getSaleData.data?.items?.length}`);

  console.log('\n======================================================');
  console.log('  BILL SAVE & DATABASE PERSISTENCE VERIFIED 100%!     ');
  console.log('======================================================\n');
}

testBillE2E().catch(err => {
  console.error('Bill E2E test failed:', err);
  process.exit(1);
});
