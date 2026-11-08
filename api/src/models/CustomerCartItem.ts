import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface CustomerCartItemAttributes {
  id: number;
  cart_id: number;
  product_id: number;
  quantity: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerCartItemCreationAttributes
  extends Optional<CustomerCartItemAttributes, "id" | "quantity" | "created_at" | "updated_at"> {}

export class CustomerCartItem
  extends Model<CustomerCartItemAttributes, CustomerCartItemCreationAttributes>
  implements CustomerCartItemAttributes
{
  public id!: number;
  public cart_id!: number;
  public product_id!: number;
  public quantity!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CustomerCartItem.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    cart_id: { type: DataTypes.BIGINT, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
  },
  {
    sequelize,
    modelName: "CustomerCartItem",
    tableName: "customer_cart_items",
    indexes: [
      { unique: true, fields: ["cart_id", "product_id"] },
      { fields: ["cart_id"] },
      { fields: ["product_id"] },
    ],
  }
);

export default CustomerCartItem;

