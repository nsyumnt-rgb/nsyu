"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Owner = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Owner extends sequelize_1.Model {
}
exports.Owner = Owner;
Owner.init({
    id: { type: sequelize_1.DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING(150), allowNull: false },
    email: { type: sequelize_1.DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: sequelize_1.DataTypes.STRING(255), allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING(20) },
    status: {
        type: sequelize_1.DataTypes.ENUM("active", "suspended"),
        defaultValue: "active",
    },
    reference_code: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
}, {
    sequelize: database_1.default,
    modelName: "Owner",
    tableName: "owners",
    indexes: [{ fields: ["reference_code"] }],
});
//# sourceMappingURL=Owner.js.map