import { Sequelize, Dialect } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

/**
 * Dialect selection:
 * Supports SQLite (for tests), DATABASE_URL connection string,
 * PostgreSQL (e.g. Supabase), or MySQL (default).
 */
const envDialect = process.env.DB_DIALECT || (process.env.DB_PORT === "5432" || process.env.DB_HOST?.includes("supabase") || process.env.DATABASE_URL?.startsWith("postgres") ? "postgres" : "postgres");
const dialect: Dialect = (process.env.TEST_DIALECT as Dialect) || (envDialect as Dialect);
const isSqlite = dialect === "sqlite";
const isPostgres = true;

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME || "postgres";
const DB_PORT = Number(process.env.DB_PORT) || 5432;

if (!isSqlite && !process.env.DATABASE_URL && (!DB_HOST || !DB_USER || !DB_PASS)) {
  throw new Error(
    "Database configuration error: Missing required database environment variables (DATABASE_URL or DB_HOST, DB_USER, DB_PASS). Please configure them in environment variables or your hosting provider's secret store."
  );
}

export const sequelize = isSqlite
  ? new Sequelize({
      dialect: "sqlite",
      storage: process.env.DB_STORAGE || ":memory:",
      logging: false,
      define: { underscored: true, timestamps: true },
      pool: { max: 1, min: 1, idle: Infinity, acquire: 60000 },
    })
  : process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
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
  : new Sequelize(
      DB_NAME,
      DB_USER!,
      DB_PASS!,
      {
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
      }
    );

export default sequelize;

