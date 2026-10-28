"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeShop = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class EmployeeShop extends sequelize_1.Model {
}
exports.EmployeeShop = EmployeeShop;
EmployeeShop.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    employee_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
    role_id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "EmployeeShop",
    tableName: "employee_shops",
    indexes: [
        { unique: true, fields: ["employee_id", "shop_id"] },
        { fields: ["shop_id"] },
    ],
});
//# sourceMappingURL=EmployeeShop.js.map