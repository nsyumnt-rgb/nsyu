"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Shop = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Shop extends sequelize_1.Model {
}
exports.Shop = Shop;
Shop.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    code: { type: sequelize_1.DataTypes.STRING(30), allowNull: false },
    address: { type: sequelize_1.DataTypes.STRING(255) },
    phone: { type: sequelize_1.DataTypes.STRING(20) },
    email: { type: sequelize_1.DataTypes.STRING(150) },
    logo: { type: sequelize_1.DataTypes.STRING(255) },
    status: { type: sequelize_1.DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Shop",
    tableName: "shops",
    indexes: [
        { unique: true, fields: ["owner_id", "code"] }, // shop code unique per owner
        { fields: ["owner_id"] },
        { fields: ["reference_code"] },
    ],
});
//# sourceMappingURL=Shop.js.map