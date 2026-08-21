import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const project = path.join(process.cwd(), ".ohmypi-test", "e2e-project");

test.beforeAll(() => {
  mkdirSync(project, { recursive: true });
  writeFileSync(path.join(project, "README.md"), "e2e");
});

test("workbench core loop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("还没有对话")).toBeVisible();

  await page.getByRole("button", { name: "开始对话" }).click();
  await page.getByRole("button", { name: "输入路径" }).click();
  await page.getByLabel("工作文件夹").fill(project);
  await page.getByLabel("标题").fill("E2E task");
  await page.getByRole("button", { name: "创建对话" }).click();
  await expect(page.getByRole("banner").getByText("E2E task")).toBeVisible();
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });

  await page.getByLabel("输入消息").fill("hello from e2e please stream this slowly for steer");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("输入消息").fill("steer now");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("Steered: steer now").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);

  await page.getByLabel("输入消息").fill("change course");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("Echo: change course").first()).toBeVisible();

  await page.getByLabel("输入消息").fill("WRITE:denied.txt:secret");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("heading", { name: "允许修改文件吗？" })).toBeVisible();
  await page.getByRole("button", { name: "拒绝" }).click();
  expect(existsSync(path.join(project, "denied.txt"))).toBe(false);
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);

  await page.getByLabel("输入消息").fill("BASH:echo hi");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("heading", { name: "允许运行这条命令吗？" })).toBeVisible();
  await page.getByRole("button", { name: "拒绝" }).click();

  await page.reload();
  await expect(page.getByText("Steered: steer now").first()).toBeVisible();

  await page.getByRole("button", { name: "选项" }).click();
  await page.getByLabel("思考深度").selectOption("high");
  await page.getByRole("button", { name: "会话" }).click();
  await page.getByRole("button", { name: /归档 E2E task/ }).click();
});

test("keyboard and viewports", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }));
  });
  await expect(page.getByRole("heading", { name: "新对话" })).toBeVisible();
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
  await page.getByRole("button", { name: "开始对话" }).click();
  await page.getByRole("button", { name: "输入路径" }).click();
  await page.getByLabel("工作文件夹").fill(project);
  await page.getByLabel("标题").fill("Visual task");
  await page.getByRole("button", { name: "创建对话" }).click();
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
  }
});
