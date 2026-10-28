/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 60000,
  maxWorkers: 1, // shared in-memory SQLite DB — tests must run serially within a file, and files don't share state
  verbose: true,
};
