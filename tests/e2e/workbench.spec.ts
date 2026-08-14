import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const project = path.join(process.cwd(), ".mypi-test", "e2e-project");

test.beforeAll(() => {
  mkdirSync(project, { recursive: true });
  writeFileSync(path.join(project, "README.md"), "e2e");
});

test("workbench core loop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No task selected")).toBeVisible();

  await page.getByRole("button", { name: "New task" }).click();
  await page.getByRole("button", { name: "Type path" }).click();
  await page.getByLabel("Working directory").fill(project);
  await page.getByLabel("Title").fill("E2E task");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("banner").getByText("E2E task")).toBeVisible();
  await expect(page.getByLabel("Prompt")).toBeEnabled({ timeout: 15_000 });

  await page.getByLabel("Prompt").fill("hello from e2e please stream this slowly for steer");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("button", { name: "Steer" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Prompt").fill("steer now");
  await page.getByRole("button", { name: "Steer" }).click();
  await expect(page.getByText("Steered: steer now").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Follow-up" })).toBeVisible();

  await page.getByLabel("Prompt").fill("change course");
  await page.getByRole("button", { name: "Follow-up" }).click();
  await expect(page.getByText("Echo: change course").first()).toBeVisible();

  await page.getByLabel("Prompt").fill("WRITE:denied.txt:secret");
  await page.getByRole("button", { name: "Follow-up" }).click();
  await expect(page.getByRole("heading", { name: /Allow write/ })).toBeVisible();
  await page.getByRole("button", { name: "Deny" }).click();
  expect(existsSync(path.join(project, "denied.txt"))).toBe(false);
  await expect(page.getByRole("button", { name: "Follow-up" })).toBeVisible();

  await page.getByLabel("Prompt").fill("BASH:echo hi");
  await page.getByRole("button", { name: "Follow-up" }).click();
  await expect(page.getByRole("heading", { name: /Allow bash/ })).toBeVisible();
  await page.getByRole("button", { name: "Deny" }).click();

  await page.reload();
  await expect(page.getByText("Steered: steer now").first()).toBeVisible();

  await page.getByLabel("Thinking level").selectOption("high");
  await page.getByRole("button", { name: /Archive E2E task/ }).click();
});

test("keyboard and viewports", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }));
  });
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
  await page.keyboard.press("Escape");

  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 375, height: 812 },
  ] as const) {
    await page.setViewportSize(size);
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});

test("reduced motion disables the status ring spin", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "pi-ring-spin";
    document.body.appendChild(el);
    return getComputedStyle(el).animationDuration;
  });
  expect(duration === "0s" || duration === "0.01ms").toBeTruthy();
});

test("visual workbench at required viewports", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByRole("button", { name: "Type path" }).click();
  await page.getByLabel("Working directory").fill(project);
  await page.getByLabel("Title").fill("Visual task");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("banner").getByText("Visual task")).toBeVisible();

  for (const size of [
    { name: "1440", width: 1440, height: 900 },
    { name: "1280", width: 1280, height: 800 },
    { name: "375", width: 375, height: 812 },
  ] as const) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await expect(page).toHaveScreenshot(`workbench-${size.name}.png`, {
      maxDiffPixelRatio: 0.04,
    });
  }
});
