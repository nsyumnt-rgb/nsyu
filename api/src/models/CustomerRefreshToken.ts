import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface CustomerRefreshTokenAttributes {
  id: number;
  account_id: number;
  token_hash: string;
  device_info?: string | null;
  expires_at: Date;
  revoked_at?: Date | null;
  created_at?: Date;
}

export interface CustomerRefreshTokenCreationAttributes
  extends Optional<CustomerRefreshTokenAttributes, "id" | "device_info" | "revoked_at" | "created_at"> {}

export class CustomerRefreshToken
  extends Model<CustomerRefreshTokenAttributes, CustomerRefreshTokenCreationAttributes>
  implements CustomerRefreshTokenAttributes
{
  public id!: number;
  public account_id!: number;
  public token_hash!: string;
  public device_info?: string | null;
  public expires_at!: Date;
  public revoked_at?: Date | null;
  public readonly created_at!: Date;
}

CustomerRefreshToken.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    account_id: { type: DataTypes.BIGINT, allowNull: false },
    token_hash: { type: DataTypes.STRING(255), allowNull: false },
    device_info: { type: DataTypes.STRING(255), allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "CustomerRefreshToken",
    tableName: "customer_refresh_tokens",
    updatedAt: false,
    indexes: [
      { fields: ["account_id"] },
      { fields: ["token_hash"] },
      { fields: ["expires_at"] },
    ],
  }
);

export default CustomerRefreshToken;

