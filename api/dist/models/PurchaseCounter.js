"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseCounter = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class PurchaseCounter extends sequelize_1.Model {
}
exports.PurchaseCounter = PurchaseCounter;
PurchaseCounter.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    last_number: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
    sequelize: database_1.default,
    modelName: "PurchaseCounter",
    tableName: "purchase_counters",
    timestamps: false,
    indexes: [{ unique: true, fields: ["owner_id", "shop_id"] }],
});
//# sourceMappingURL=PurchaseCounter.js.map