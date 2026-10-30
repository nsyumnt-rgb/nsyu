"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class AuditLog extends sequelize_1.Model {
}
exports.AuditLog = AuditLog;
AuditLog.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    owner_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    shop_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    actor_type: { type: sequelize_1.DataTypes.ENUM("owner", "employee"), allowNull: false },
    actor_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    module: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    action: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    entity_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    entity_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    old_value: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    new_value: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    details: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    ip_address: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "AuditLog",
    tableName: "audit_logs",
    updatedAt: false, // logs are immutable, created_at only
    indexes: [
        { fields: ["owner_id"] },
        { fields: ["shop_id"] },
        { fields: ["module"] },
    ],
});
//# sourceMappingURL=AuditLog.js.map