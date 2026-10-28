import { sequelize } from "../src/models";

beforeAll(async () => {
  // force: true drops+recreates every table against the fresh
  // file-backed SQLite DB for this test file — each test FILE gets a
  // clean slate, and tests within a file share it (see helpers.ts for
  // per-test isolation via unique emails/codes rather than truncation).
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});
