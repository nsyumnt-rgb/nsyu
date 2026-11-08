"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopPortalSettings = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ShopPortalSettings extends sequelize_1.Model {
}
exports.ShopPortalSettings = ShopPortalSettings;
ShopPortalSettings.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, unique: true },
    show_stock_qty: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_self_registration: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    allow_orders: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    min_order_value: { type: sequelize_1.DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    allow_customer_cancel: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    sequelize: database_1.default,
    modelName: "ShopPortalSettings",
    tableName: "shop_portal_settings",
    indexes: [{ unique: true, fields: ["shop_id"] }],
});
exports.default = ShopPortalSettings;
//# sourceMappingURL=ShopPortalSettings.js.map