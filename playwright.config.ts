import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4310",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "rm -rf .mowen-test/e2e && mkdir -p .mowen-test/e2e-project .mowen-test/e2e-home && MOWEN_E2E=1 HOST=127.0.0.1 PORT=4310 NODE_ENV=production pnpm build && MOWEN_E2E=1 HOST=127.0.0.1 PORT=4310 NODE_ENV=production MOWEN_DATA_DIR=./.mowen-test/e2e MOWEN_HOME_DIR=./.mowen-test/e2e-home PI_BIN=./tests/fixtures/fake-pi.mjs MOWEN_ALLOWED_ROOTS=./.mowen-test/e2e-project MOWEN_MAX_PROCESSES=3 MOWEN_MUTATIONS=approval pnpm start",
    url: "http://127.0.0.1:4310/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
