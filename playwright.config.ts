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
      "rm -rf .ohmypi-test/e2e && mkdir -p .ohmypi-test/e2e-project && OHMYPI_E2E=1 HOST=127.0.0.1 PORT=4310 NODE_ENV=production pnpm build && OHMYPI_E2E=1 HOST=127.0.0.1 PORT=4310 NODE_ENV=production OHMYPI_DATA_DIR=./.ohmypi-test/e2e PI_BIN=./tests/fixtures/fake-pi.mjs OHMYPI_ALLOWED_ROOTS=./.ohmypi-test/e2e-project OHMYPI_MAX_PROCESSES=3 OHMYPI_MUTATIONS=approval pnpm start",
    url: "http://127.0.0.1:4310/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
