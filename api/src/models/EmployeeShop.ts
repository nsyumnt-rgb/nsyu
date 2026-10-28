import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

/**
 * An employee can be assigned to multiple shops, and can hold a
 * DIFFERENT role in each shop (e.g. Manager at Shop A, Sales Staff
 * at Shop B). This is what "switch shop" reads from.
 */
interface EmployeeShopAttributes {
  id: number;
  employee_id: number;
  shop_id: number;
  role_id: number;
}

interface EmployeeShopCreationAttributes extends Optional<EmployeeShopAttributes, "id"> {}

export class EmployeeShop
  extends Model<EmployeeShopAttributes, EmployeeShopCreationAttributes>
  implements EmployeeShopAttributes
{
  public id!: number;
  public employee_id!: number;
  public shop_id!: number;
  public role_id!: number;
}

EmployeeShop.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    role_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  {
    sequelize,
    modelName: "EmployeeShop",
    tableName: "employee_shops",
    indexes: [
      { unique: true, fields: ["employee_id", "shop_id"] },
      { fields: ["shop_id"] },
    ],
  }
);
