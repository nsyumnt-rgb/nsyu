"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusHistory = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class StatusHistory extends sequelize_1.Model {
}
exports.StatusHistory = StatusHistory;
StatusHistory.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    entity_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    entity_id: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    old_status: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    new_status: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    changed_by_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    changed_by_role: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
}, {
    sequelize: database_1.default,
    modelName: "StatusHistory",
    tableName: "status_history",
    timestamps: false,
    indexes: [
        { fields: ["shop_id"] },
        { fields: ["entity_type", "entity_id"] },
        { fields: ["created_at"] },
    ],
});
exports.default = StatusHistory;
//# sourceMappingURL=StatusHistory.js.map