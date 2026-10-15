import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3101" },
  webServer: {
    command: "npm run start -- --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      APP_ORIGIN: "http://127.0.0.1:3101",
      ENABLE_DEV_MAIL: "true",
      ENABLE_TICKETING_PREVIEW: "true",
      TICKETING_WEBHOOK_SECRET:
        "ticketing-production-test-only-secret-at-least-32-characters",
      DB_PATH: `.data/production-test-${Date.now()}`,
      AUTH_SECRET: "production-test-only-secret-at-least-32-characters",
    },
  },
});
