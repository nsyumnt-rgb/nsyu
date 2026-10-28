import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface OwnerAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  phone?: string;
  status: "active" | "suspended";
  reference_code?: string | null;
}

interface OwnerCreationAttributes
  extends Optional<OwnerAttributes, "id" | "status" | "reference_code"> {}

export class Owner
  extends Model<OwnerAttributes, OwnerCreationAttributes>
  implements OwnerAttributes
{
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public phone?: string;
  public status!: "active" | "suspended";
  public reference_code?: string | null;
}

Owner.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20) },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active",
    },
    reference_code: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    sequelize,
    modelName: "Owner",
    tableName: "owners",
    indexes: [{ fields: ["reference_code"] }],
  }
);
