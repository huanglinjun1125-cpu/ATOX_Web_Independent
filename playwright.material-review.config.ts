import { defineConfig } from "@playwright/test";
import path from "node:path";

const fixtureFile =
  process.env.ADMIN_FIXTURE_FILE ||
  path.resolve(`.data/admin-e2e-${Date.now()}/identities.json`);
process.env.ADMIN_FIXTURE_FILE = fixtureFile;
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "material-review.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/material-review",
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
      NEXT_DIST_DIR: ".next-material-review-e2e",
      ENABLE_DEV_MAIL: "true",
      APP_ORIGIN: "http://127.0.0.1:3100",
      AUTH_SECRET: "material-review-test-only-secret-at-least-32-characters",
      TRUST_PROXY: "false",
      EVENT_REVIEWER_EMAILS: "reviewer@example.com",
      UPLOAD_PATH: path.join(path.dirname(fixtureFile), "uploads"),
      ENABLE_TICKETING_PREVIEW: "false",
      TICKETING_WEBHOOK_SECRET:
        "material-review-ticketing-test-only-secret-at-least-32-characters",
    },
  },
});
