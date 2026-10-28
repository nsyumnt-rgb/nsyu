import { Owner, Shop, Employee, RefreshToken, EmployeeShop, Role, RolePermission, RoleFieldPermission } from '../models';

async function run() {
  const o2 = await Owner.findByPk(2);
  if (o2) {
    console.log('Found demo owner 2, cleaning up demo data...');
    // Delete role permissions for roles belonging to owner 2
    const roles = await Role.findAll({ where: { owner_id: 2 } });
    for (const r of roles) {
      await RolePermission.destroy({ where: { role_id: r.id } });
      await RoleFieldPermission.destroy({ where: { role_id: r.id } });
      await r.destroy();
    }
    // Delete employees and shops belonging to owner 2
    const employees = await Employee.findAll({ where: { owner_id: 2 } });
    for (const emp of employees) {
      await EmployeeShop.destroy({ where: { employee_id: emp.id } });
      await emp.destroy();
    }
    await Shop.destroy({ where: { owner_id: 2 } });
    await RefreshToken.destroy({ where: { owner_id: 2 } });
    await o2.destroy();
    console.log('Demo owner 2 and all demo records successfully deleted!');
  } else {
    console.log('No demo owner 2 found.');
  }

  console.log('Active Owners in Database:');
  const activeOwners = await Owner.findAll({ raw: true });
  console.log(activeOwners.map(o => ({ id: o.id, name: o.name, email: o.email, status: o.status })));

  console.log('Active Shops in Database:');
  const activeShops = await Shop.findAll({ raw: true });
  console.log(activeShops.map(s => ({ id: s.id, owner_id: s.owner_id, name: s.name, code: s.code })));

  process.exit(0);
}

run();
