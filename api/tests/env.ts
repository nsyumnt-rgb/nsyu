// Runs via jest.config.js's `setupFiles` (earliest possible hook —
// before any test file's own import statements execute), so that by
// the time a test does `import app from "../src/app"`, which
// transitively pulls in models -> config/database.ts, these env vars
// are already in place. This is the ONLY way config/database.ts ever
// switches to SQLite — a real deployment never sets TEST_DIALECT.
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRES = "15m";
process.env.JWT_REFRESH_EXPIRES = "30d";
process.env.NODE_ENV = "test";
