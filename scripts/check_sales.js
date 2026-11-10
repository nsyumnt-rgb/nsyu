const { Sale } = require('../api/dist/models');

async function run() {
  const sales = await Sale.findAll({ order: [['id', 'DESC']] });
  for (const s of sales.slice(0, 10)) {
    console.log(`Sale #${s.id} (${s.invoice_number}): Total ₹${s.total_amount}, Paid ₹${s.paid_amount}, Due ₹${s.due_amount}, Status: [${s.status}], Updated: ${s.updatedAt}`);
  }
  process.exit(0);
}
run();

