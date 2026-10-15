import { defineConfig } from "@playwright/test";
import path from "node:path";

// Fixtures belong only to this isolated test server; never open the live DB.
const fixtureFile =
  process.env.ADMIN_FIXTURE_FILE ||
  path.resolve(`.data/admin-e2e-${Date.now()}/identities.json`);
process.env.ADMIN_FIXTURE_FILE = fixtureFile;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/admin",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npx tsx tests/fixtures/admin-server.ts",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      ADMIN_FIXTURE_FILE: fixtureFile,
      DB_PATH: path.join(path.dirname(fixtureFile), "db"),
      NEXT_DIST_DIR: ".next-ticket-orders-e2e",
      ENABLE_DEV_MAIL: "true",
      APP_ORIGIN: "http://127.0.0.1:3100",
      AUTH_SECRET: "admin-browser-test-only-secret-at-least-32-characters",
      TRUST_PROXY: "false",
      EVENT_REVIEWER_EMAILS: "reviewer@example.com",
      UPLOAD_PATH: path.join(path.dirname(fixtureFile), "uploads"),
      ENABLE_TICKETING_PREVIEW: "true",
      TICKETING_WEBHOOK_SECRET:
        "admin-ticketing-test-only-secret-at-least-32-characters",
    },
  },
});
