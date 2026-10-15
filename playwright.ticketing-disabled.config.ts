import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ticketing-disabled",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3102" },
  webServer: {
    command: "npm run dev -- --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ORIGIN: "http://127.0.0.1:3102",
      ENABLE_TICKETING_PREVIEW: "false",
      DB_PATH: `.data/ticketing-disabled-${Date.now()}`,
      AUTH_SECRET: "disabled-preview-test-only-secret-at-least-32-characters",
    },
  },
});
