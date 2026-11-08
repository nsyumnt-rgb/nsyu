"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerCart = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class CustomerCart extends sequelize_1.Model {
}
exports.CustomerCart = CustomerCart;
CustomerCart.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    customer_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
}, {
    sequelize: database_1.default,
    modelName: "CustomerCart",
    tableName: "customer_carts",
    indexes: [
        { unique: true, fields: ["customer_id", "shop_id"] },
        { fields: ["customer_id"] },
    ],
});
exports.default = CustomerCart;
//# sourceMappingURL=CustomerCart.js.map