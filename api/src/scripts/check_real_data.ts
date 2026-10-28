import { Owner, Shop, Product, Customer, Sale, Employee } from '../models';

async function run() {
  console.log('--- OWNERS ---');
  const owners = await Owner.findAll({ raw: true });
  console.log(owners.map(o => ({ id: o.id, email: o.email, name: o.name, phone: o.phone, status: o.status })));

  console.log('--- SHOPS ---');
  const shops = await Shop.findAll({ raw: true });
  console.log(shops.map(s => ({ id: s.id, owner_id: s.owner_id, name: s.name, code: s.code })));

  console.log('--- PRODUCTS (sample) ---');
  const products = await Product.findAll({ limit: 10, raw: true });
  console.log(products.map(p => ({ id: p.id, owner_id: p.owner_id, name: p.name, code: p.code, price: p.selling_price })));

  console.log('--- PRODUCT TOTAL ---', await Product.count());
  console.log('--- CUSTOMER TOTAL ---', await Customer.count());
  console.log('--- SALE TOTAL ---', await Sale.count());
  console.log('--- EMPLOYEE TOTAL ---', await Employee.count());

  process.exit(0);
}

run();
