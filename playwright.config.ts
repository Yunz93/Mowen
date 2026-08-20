import { defineConfig, devices } from "@playwright/test";

const port = process.env.MYPI_E2E_PORT ?? "4310";
const baseURL = `http://127.0.0.1:${port}`;

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
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command:
      `rm -rf .mypi-test/e2e && MYPI_E2E=1 HOST=127.0.0.1 PORT=${port} NODE_ENV=production pnpm build && MYPI_E2E=1 HOST=127.0.0.1 PORT=${port} NODE_ENV=production MYPI_DATA_DIR=./.mypi-test/e2e PI_BIN=./tests/fixtures/fake-pi.mjs MYPI_ALLOWED_ROOTS=/Users/yunz/Code/VibeCoding MYPI_MAX_PROCESSES=3 MYPI_MUTATIONS=approval pnpm start`,
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
