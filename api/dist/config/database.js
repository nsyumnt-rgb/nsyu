"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Dialect selection:
 * Supports SQLite (for tests), DATABASE_URL connection string,
 * PostgreSQL (e.g. Supabase), or MySQL (default).
 */
const envDialect = process.env.DB_DIALECT || (process.env.DB_PORT === "5432" || process.env.DB_HOST?.includes("supabase") || process.env.DATABASE_URL?.startsWith("postgres") ? "postgres" : "mysql");
const dialect = process.env.TEST_DIALECT || envDialect;
const isSqlite = dialect === "sqlite";
const isPostgres = dialect === "postgres" || Boolean(process.env.DATABASE_URL?.startsWith("postgres"));
exports.sequelize = isSqlite
    ? new sequelize_1.Sequelize({
        dialect: "sqlite",
        storage: process.env.DB_STORAGE || ":memory:",
        logging: false,
        define: { underscored: true, timestamps: true },
        pool: { max: 1, min: 1, idle: Infinity, acquire: 60000 },
    })
    : process.env.DATABASE_URL
        ? new sequelize_1.Sequelize(process.env.DATABASE_URL, {
            dialect: "postgres",
            logging: false,
            dialectOptions: {
                ssl: process.env.DB_SSL === "false"
                    ? false
                    : {
                        require: true,
                        rejectUnauthorized: false,
                    },
            },
            define: {
                underscored: true,
                timestamps: true,
            },
            pool: {
                max: 10,
                min: 0,
                acquire: 30000,
                idle: 10000,
            },
        })
        : new sequelize_1.Sequelize(process.env.DB_NAME || (isPostgres ? "postgres" : "nsyu_business"), process.env.DB_USER || (isPostgres ? "postgres" : "root"), process.env.DB_PASS || "", {
            host: process.env.DB_HOST || "localhost",
            port: Number(process.env.DB_PORT) || (isPostgres ? 5432 : 3306),
            dialect,
            logging: false,
            dialectOptions: isPostgres
                ? {
                    ssl: process.env.DB_SSL === "false"
                        ? false
                        : {
                            require: true,
                            rejectUnauthorized: false,
                        },
                }
                : undefined,
            define: {
                underscored: true, // created_at / updated_at, owner_id / shop_id etc.
                timestamps: true,
            },
            pool: {
                max: 10,
                min: 0,
                acquire: 30000,
                idle: 10000,
            },
        });
exports.default = exports.sequelize;
//# sourceMappingURL=database.js.map