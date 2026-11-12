import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import type { Customer } from "./Customer";

export const CUSTOMER_ACCOUNT_STATUSES = ["pending_approval", "active", "disabled"] as const;
export type CustomerAccountStatus = (typeof CUSTOMER_ACCOUNT_STATUSES)[number];

export interface CustomerAccountAttributes {
  id: number;
  customer_id: number;
  shop_id: number;
  owner_id: number;
  phone: string;
  email?: string | null;
  status: CustomerAccountStatus;
  password_hash?: string | null;
  supabase_uid?: string | null;
  last_login_at?: Date | null;
  created_by?: number | null;
  approved_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerAccountCreationAttributes
  extends Optional<
    CustomerAccountAttributes,
    "id" | "email" | "password_hash" | "supabase_uid" | "last_login_at" | "created_by" | "approved_by" | "created_at" | "updated_at"
  > {}

export class CustomerAccount
  extends Model<CustomerAccountAttributes, CustomerAccountCreationAttributes>
  implements CustomerAccountAttributes
{
  public id!: number;
  public customer_id!: number;
  public shop_id!: number;
  public owner_id!: number;
  public phone!: string;
  public email?: string | null;
  public status!: CustomerAccountStatus;
  public password_hash?: string | null;
  public supabase_uid?: string | null;
  public last_login_at?: Date | null;
  public created_by?: number | null;
  public approved_by?: number | null;
  public customer?: Customer;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CustomerAccount.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: true },
    status: {
      type: DataTypes.ENUM(...CUSTOMER_ACCOUNT_STATUSES),
      allowNull: false,
      defaultValue: "active",
    },
    password_hash: { type: DataTypes.STRING(255), allowNull: true },
    supabase_uid: { type: DataTypes.UUID, allowNull: true },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    approved_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "CustomerAccount",
    tableName: "customer_accounts",
    indexes: [
      { unique: true, fields: ["customer_id"] },
      { fields: ["shop_id", "phone"] },
      { fields: ["owner_id"] },
      { fields: ["status"] },
    ],
  }
);

export default CustomerAccount;

