import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface CustomerCartAttributes {
  id: number;
  customer_id: number;
  shop_id: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerCartCreationAttributes
  extends Optional<CustomerCartAttributes, "id" | "created_at" | "updated_at"> {}

export class CustomerCart
  extends Model<CustomerCartAttributes, CustomerCartCreationAttributes>
  implements CustomerCartAttributes
{
  public id!: number;
  public customer_id!: number;
  public shop_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CustomerCart.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "CustomerCart",
    tableName: "customer_carts",
    indexes: [
      { unique: true, fields: ["customer_id", "shop_id"] },
      { fields: ["customer_id"] },
    ],
  }
);

export default CustomerCart;

