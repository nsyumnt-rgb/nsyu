"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformAuditLog = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class PlatformAuditLog extends sequelize_1.Model {
}
exports.PlatformAuditLog = PlatformAuditLog;
PlatformAuditLog.init({
    id: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    super_admin_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    super_admin_email: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    action: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
    target_type: { type: sequelize_1.DataTypes.STRING(50), allowNull: false },
    target_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    target_name: { type: sequelize_1.DataTypes.STRING(150), allowNull: true },
    details: { type: sequelize_1.DataTypes.JSONB, allowNull: true, defaultValue: {} },
    ip_address: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
}, {
    sequelize: database_1.default,
    modelName: "PlatformAuditLog",
    tableName: "platform_audit_log",
    timestamps: false,
    indexes: [
        { fields: ["super_admin_id"] },
        { fields: ["action"] },
        { fields: ["created_at"] },
    ],
});
exports.default = PlatformAuditLog;
//# sourceMappingURL=PlatformAuditLog.js.map