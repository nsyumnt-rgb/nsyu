import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface RefreshTokenAttributes {
  id: number;
  token: string;
  owner_id?: number | null;
  employee_id?: number | null;
  expires_at: Date;
  revoked: boolean;
}

interface RefreshTokenCreationAttributes
  extends Optional<RefreshTokenAttributes, "id" | "owner_id" | "employee_id" | "revoked"> {}

export class RefreshToken
  extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes>
  implements RefreshTokenAttributes
{
  public id!: number;
  public token!: string;
  public owner_id?: number | null;
  public employee_id?: number | null;
  public expires_at!: Date;
  public revoked!: boolean;
}

RefreshToken.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    token: { type: DataTypes.STRING(500), allowNull: false, unique: true },
    owner_id: { type: DataTypes.INTEGER, allowNull: true },
    employee_id: { type: DataTypes.INTEGER, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: "RefreshToken", tableName: "refresh_tokens" }
);
