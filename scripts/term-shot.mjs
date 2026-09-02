import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, "scripts", "term-shot");
const { mkdirSync } = await import("node:fs");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:5173/");
await page.waitForLoadState("networkidle");

// New conversation → choose folder
const newBtn = page.getByRole("button", { name: "新对话" });
if (await newBtn.isVisible().catch(() => false)) {
  await newBtn.click();
  const pathBtn = page.getByRole("button", { name: "输入路径" });
  if (await pathBtn.isVisible().catch(() => false)) {
    await pathBtn.click();
    await page.getByLabel("工作文件夹").fill("/Users/yunz/Code/VibeCoding/MyPi");
    await page.getByRole("button", { name: "创建对话" }).click();
    await page.waitForTimeout(1200);
  }
}

// Open inspector, pin it, go to 终端 tab
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, "debug.png") });
const detailBtn = page.getByRole("button", { name: "详情" });
if (await detailBtn.isVisible().catch(() => false)) await detailBtn.click();
const pinBtn = page.getByRole("button", { name: "固定详情" });
if (await pinBtn.isVisible().catch(() => false)) await pinBtn.click();
await page.getByRole("button", { name: "终端" }).click();
await page.waitForTimeout(600);

// Light theme shot
await page.screenshot({ path: path.join(out, "term-light.png") });

// Dark theme shot
const themeBtn = page.getByRole("button", { name: /主题|切换主题/ });
if (await themeBtn.isVisible().catch(() => false)) {
  await themeBtn.click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: path.join(out, "term-dark.png") });

// Run a command to show output
const input = page.getByLabel("终端命令");
await input.fill("echo hello from terminal");
await page.getByRole("button", { name: "运行" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, "term-run.png") });

await browser.close();
console.log("done →", out);
