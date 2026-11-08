import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface CustomerOtpAttributes {
  id: number;
  account_id?: number | null;
  phone: string;
  shop_id: number;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used_at?: Date | null;
  created_at?: Date;
}

export interface CustomerOtpCreationAttributes
  extends Optional<CustomerOtpAttributes, "id" | "account_id" | "attempts" | "used_at" | "created_at"> {}

export class CustomerOtp
  extends Model<CustomerOtpAttributes, CustomerOtpCreationAttributes>
  implements CustomerOtpAttributes
{
  public id!: number;
  public account_id?: number | null;
  public phone!: string;
  public shop_id!: number;
  public otp_hash!: string;
  public expires_at!: Date;
  public attempts!: number;
  public used_at?: Date | null;
  public readonly created_at!: Date;
}

CustomerOtp.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    account_id: { type: DataTypes.BIGINT, allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    shop_id: { type: DataTypes.INTEGER, allowNull: false },
    otp_hash: { type: DataTypes.STRING(255), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    used_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "CustomerOtp",
    tableName: "customer_otps",
    updatedAt: false,
    indexes: [
      { fields: ["phone", "shop_id"] },
      { fields: ["account_id"] },
      { fields: ["expires_at"] },
    ],
  }
);

export default CustomerOtp;

