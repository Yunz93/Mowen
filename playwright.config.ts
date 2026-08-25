import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = path.dirname(fileURLToPath(import.meta.url));
const e2eHome = path.resolve(root, ".mowen-test/e2e-home");
const e2eData = path.resolve(root, ".mowen-test/e2e");
const e2eProject = path.resolve(root, ".mowen-test/e2e-project");
const fakePi = path.resolve(root, "tests/fixtures/fake-pi.mjs");

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
    command: [
      `rm -rf ${e2eData}`,
      `mkdir -p ${e2eProject} ${e2eHome}`,
      "MOWEN_E2E=1 HOST=127.0.0.1 PORT=4310 NODE_ENV=production pnpm build",
      [
        "MOWEN_E2E=1 HOST=127.0.0.1 PORT=4310 NODE_ENV=production",
        `MOWEN_DATA_DIR=${e2eData}`,
        `MOWEN_HOME_DIR=${e2eHome}`,
        `PI_BIN=${fakePi}`,
        `MOWEN_ALLOWED_ROOTS=${e2eProject}`,
        "MOWEN_MAX_PROCESSES=8 MOWEN_MUTATIONS=approval pnpm start",
      ].join(" "),
    ].join(" && "),
    url: "http://127.0.0.1:4310/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

