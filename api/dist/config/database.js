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
const envDialect = process.env.DB_DIALECT || (process.env.DB_PORT === "5432" || process.env.DB_HOST?.includes("supabase") || process.env.DATABASE_URL?.startsWith("postgres") ? "postgres" : "postgres");
const dialect = process.env.TEST_DIALECT || envDialect;
const isSqlite = dialect === "sqlite";
const isPostgres = true;
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME || "postgres";
const DB_PORT = Number(process.env.DB_PORT) || 5432;
if (!isSqlite && !process.env.DATABASE_URL && (!DB_HOST || !DB_USER || !DB_PASS)) {
    throw new Error("Database configuration error: Missing required database environment variables (DATABASE_URL or DB_HOST, DB_USER, DB_PASS). Please configure them in environment variables or your hosting provider's secret store.");
}
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
        : new sequelize_1.Sequelize(DB_NAME, DB_USER, DB_PASS, {
            host: DB_HOST,
            port: DB_PORT,
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