"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerCartItem = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class CustomerCartItem extends sequelize_1.Model {
}
exports.CustomerCartItem = CustomerCartItem;
CustomerCartItem.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    cart_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    product_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    quantity: { type: sequelize_1.DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
}, {
    sequelize: database_1.default,
    modelName: "CustomerCartItem",
    tableName: "customer_cart_items",
    indexes: [
        { unique: true, fields: ["cart_id", "product_id"] },
        { fields: ["cart_id"] },
        { fields: ["product_id"] },
    ],
});
exports.default = CustomerCartItem;
//# sourceMappingURL=CustomerCartItem.js.map