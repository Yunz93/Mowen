import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";

const project = path.join(process.cwd(), ".mowen-test", "e2e-project");
const home = path.join(process.cwd(), ".mowen-test", "e2e-home");

test.beforeAll(() => {
  mkdirSync(project, { recursive: true });
  mkdirSync(path.join(home, ".pi", "agent", "skills", "demo"), { recursive: true });
  mkdirSync(path.join(home, ".pi", "agent", "sessions", "e2e"), { recursive: true });
  writeFileSync(path.join(project, "README.md"), "e2e");
  writeFileSync(path.join(project, "AGENTS.md"), "# e2e agents");
  writeFileSync(
    path.join(home, ".pi", "agent", "auth.json"),
    JSON.stringify({ github: { type: "oauth" } }),
  );
  writeFileSync(path.join(home, ".pi", "agent", "models.json"), JSON.stringify({ models: [{ id: "fake" }] }));
  writeFileSync(path.join(home, ".pi", "agent", "skills", "demo", "SKILL.md"), "# demo");
  writeFileSync(
    path.join(home, ".pi", "agent", "sessions", "e2e", "resume.jsonl"),
    [
      JSON.stringify({ type: "session", id: "e2e-resume", cwd: project }),
      JSON.stringify({
        type: "message",
        message: { role: "user", content: [{ type: "text", text: "resume from e2e" }] },
      }),
    ].join("\n"),
  );
  rmSync(path.join(project, "denied.txt"), { force: true });
});

test("workbench core loop", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "新对话" }).click();
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

  await page.getByRole("button", { name: "选项" }).click();
  await page.getByLabel("审批").selectOption("ask");
  await page.getByRole("button", { name: "选项" }).click();

  await page.getByLabel("输入消息").fill("WRITE:denied.txt:secret");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("heading", { name: "允许修改文件吗？" })).toBeVisible();
  await page.getByLabel("输入消息").click({ force: true });
  await expect(page.getByRole("button", { name: "允许这次" })).toBeVisible();
  await page.getByRole("button", { name: "拒绝", exact: true }).click();
  expect(existsSync(path.join(project, "denied.txt"))).toBe(false);
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);

  await page.getByLabel("输入消息").fill("BASH:echo hi");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("heading", { name: "允许运行这条命令吗？" })).toBeVisible();
  await page.locator(".composer-well").click({ force: true, position: { x: 24, y: 16 } });
  await expect(page.getByRole("button", { name: "拒绝", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "拒绝", exact: true }).click();

  await page.reload();
  await expect(page.getByText("Steered: steer now").first()).toBeVisible();

  await page.getByRole("button", { name: "选项" }).click();
  await page.getByLabel("思考深度").selectOption("high");
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

test("macOS traffic lights leave room for the sidebar title", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.classList.add("desktop");
    document.documentElement.dataset.platform = "darwin";
  });
  const sidebar = page.getByRole("complementary", { name: "会话" });
  await expect(sidebar).toBeVisible();
  const header = sidebar.locator(".traffic-inline");
  const paddingLeft = await header.evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(Number.parseFloat(paddingLeft)).toBeGreaterThanOrEqual(80);
  const titleLeft = await sidebar.locator("p", { hasText: /^会话$/ }).evaluate((el) => el.getBoundingClientRect().left);
  expect(titleLeft).toBeGreaterThanOrEqual(80);
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

test("pi mvp settings, skills, resume, and runtime controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("本机 Pi 登录")).toBeVisible();
  await expect(page.getByText("GitHub Copilot")).toBeVisible();
  await expect(page.getByText("订阅 / 登录")).toBeVisible();
  await expect(page.getByRole("button", { name: /检查更新|正在检查/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "检查更新" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText("更新 API Key")).toBeVisible();
  await page.getByLabel("服务商").selectOption("anthropic");
  await page.getByLabel("API Key").fill("sk-ant-e2e-updated-key-123456");
  await page.getByRole("button", { name: "保存密钥" }).click();
  await expect(page.getByText("已保存 Anthropic (Claude) 的密钥。")).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Anthropic (Claude)" })).toBeVisible();
  await expect(page.getByText(/models\.json/)).toBeVisible();
  await expect(page.getByText("已找到")).toBeVisible();
  await expect(page.getByText("信任当前项目")).toBeVisible();
  await page.getByRole("button", { name: "打开设置向导" }).click();
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("/login")).toBeVisible();
  await expect(page.getByRole("button", { name: "使用已有登录" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/");
  await page.getByRole("button", { name: "新对话" }).click();
  await expect(page.getByText("继续本机上的 Pi 会话")).toBeVisible();
  await expect(page.getByText("resume from e2e")).toBeVisible();
  await page.getByRole("button", { name: "输入路径" }).click();
  await page.getByLabel("工作文件夹").fill(project);
  await page.getByLabel("标题").fill("MVP task");
  await page.getByRole("button", { name: "创建对话" }).click();
  await expect(page.getByRole("banner").getByText("MVP task")).toBeVisible();
  await expect(page.getByText("已加载 AGENTS.md")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "详情" }).click();
  await page.getByRole("button", { name: "技能" }).click();
  await expect(page.getByRole("complementary", { name: "详情" }).getByText(/agents ·/)).toBeVisible();
  await expect(page.getByRole("complementary", { name: "详情" }).getByText("demo")).toBeVisible();
  await page.getByRole("button", { name: "动态" }).click();
  await page.getByRole("button", { name: "导出 HTML" }).click();
  await expect(page.getByText(/已导出到/)).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  await page.getByRole("button", { name: "上下文用量" }).click();
  await expect(page.getByRole("dialog", { name: "上下文用量" }).getByText(/20 \/ .+ tokens/)).toBeVisible();
  await expect(page.getByText("接近上限时自动压缩")).toBeVisible();
  await expect(page.getByText("出错时自动重试")).toBeVisible();
  await expect(page.getByLabel("压缩时额外交代")).toBeVisible();
});

test("visual workbench at required viewports", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新对话" }).click();
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

async function createTask(page: import("@playwright/test").Page, title: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "会话" })).toBeVisible();
  const list = page.getByRole("complementary", { name: "会话" }).locator("li");
  try {
    await expect.poll(async () => list.count(), { timeout: 2_000 }).toBeGreaterThan(0);
  } catch {
    // A fresh server has no leftover sessions to archive.
  }
  while ((await list.count()) > 0) {
    const count = await list.count();
    const item = list.first();
    await item.hover();
    await item.getByRole("button", { name: /^归档 / }).click();
    await expect(list).toHaveCount(count - 1);
  }
  await page.getByRole("button", { name: "新对话" }).click();
  await page.getByRole("button", { name: "输入路径" }).click();
  await page.getByLabel("工作文件夹").fill(project);
  await page.getByLabel("标题").fill(title);
  await page.getByRole("button", { name: "创建对话" }).click();
  await expect(page.getByRole("banner").getByText(title)).toBeVisible();
}

test("stacked user bubbles stay separated", async ({ page }) => {
  await createTask(page, "Bubble task");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });
  for (const text of ["alpha bubble", "beta bubble"]) {
    await page.getByLabel("输入消息").fill(text);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText(`Echo: ${text}`).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);
  const boxes = await page.locator("#main-content article").evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
  );
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < boxes.length; i += 1) {
    expect(boxes[i]?.top ?? 0).toBeGreaterThanOrEqual((boxes[i - 1]?.bottom ?? 0) - 0.5);
  }
});

test("HTTP 401 shows a red error instead of failing silently", async ({ page }) => {
  await createTask(page, "Auth 401 task");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });
  await page.getByLabel("输入消息").fill("FAIL401");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("alert").getByText(/登录已失效|HTTP 401/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("还没有 AI 密钥")).toHaveCount(0);
});

test("reload during a run keeps the agent going", async ({ page }) => {
  await createTask(page, "Reload task");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });
  await page
    .getByLabel("输入消息")
    .fill(`please stream this slowly ${"word ".repeat(80)}`);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("please stream this slowly").first()).toBeVisible();
});

test("copy reply, rename session, find in conversation, and open export", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await createTask(page, "Copy rename search");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });

  await page.getByLabel("输入消息").fill("unique copy phrase 92af");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("Echo: unique copy phrase 92af").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);

  await page.getByRole("button", { name: "复制回复" }).click();
  await expect(page.getByRole("button", { name: "复制回复" })).toHaveText("已复制");
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Echo: unique copy phrase 92af",
  );

  await page.getByRole("banner").getByText("Copy rename search").dblclick();
  await page.getByLabel("会话标题").fill("Renamed search task");
  await page.getByLabel("会话标题").press("Enter");
  await expect(page.getByRole("banner").getByText("Renamed search task")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "会话" }).getByText("Renamed search task")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+f");
  const search = page.getByTestId("conversation-search-input");
  await expect(search).toBeVisible();
  await search.fill("unique copy phrase");
  await expect(page.getByText("1 / 2")).toBeVisible();
  await expect(page.locator(".conversation-search-hit")).toHaveCount(1);
  await page.getByRole("button", { name: "下一个匹配" }).click();
  await expect(page.getByText("2 / 2")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);

  await page.getByRole("button", { name: "详情" }).click();
  await page.getByRole("button", { name: "导出 HTML" }).click();
  await expect(page.getByText(/已导出到/)).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("complementary", { name: "详情" }).getByRole("button", { name: "打开" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText("messages");
});

test("scrolling up during stream is not yanked back down", async ({ page }) => {
  await createTask(page, "Scroll task");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });
  await page.setViewportSize({ width: 1280, height: 420 });
  await page
    .getByLabel("输入消息")
    .fill(`please stream this slowly\n${"padding line to force a tall transcript\n".repeat(18)}${"word ".repeat(40)}`);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 15_000 });
  const main = page.locator("#main-content");
  await expect.poll(async () => main.evaluate((el) => el.scrollHeight > el.clientHeight + 40)).toBe(true);
  await main.evaluate((el) => {
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -140, bubbles: true }));
    el.scrollTop = 0;
  });
  await page.waitForTimeout(700);
  const remaining = await main.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
  expect(remaining).toBeGreaterThan(80);
});

test("queue follow-up while running and retry after abort", async ({ page }) => {
  await createTask(page, "Follow abort task");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });
  await page
    .getByLabel("输入消息")
    .fill(`please stream this slowly ${"word ".repeat(40)}`);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("输入消息").fill("queued next");
  await page.getByRole("button", { name: "排队" }).click();
  await expect(page.getByText("Follow-up: queued next").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0);

  await page
    .getByLabel("输入消息")
    .fill(`please stream this slowly retry-me ${"word ".repeat(40)}`);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "停止" }).click();
  await expect(page.getByRole("button", { name: "重试上一条" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "重试上一条" }).click();
  await expect(page.getByText(/Echo: please stream this slowly retry-me/).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("select dialog, undo a write, and logout then restore", async ({ page }) => {
  await createTask(page, "Select undo task");
  await expect(page.getByLabel("输入消息")).toBeEnabled({ timeout: 15_000 });

  await page.getByLabel("输入消息").fill("SELECT:alpha|beta");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByTestId("interaction-dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "alpha" }).click();
  await expect(page.getByText("Selected: alpha").first()).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("输入消息").fill("WRITE:README.md:changed-by-e2e");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "撤回这次" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "撤回这次" }).click();
  await expect.poll(() => readFileSync(path.join(project, "README.md"), "utf8")).toBe("e2e");

  const authPath = path.join(home, ".pi", "agent", "auth.json");
  const backup = readFileSync(authPath, "utf8");
  try {
    await page.goto("/settings");
    await expect(page.getByText("GitHub Copilot")).toBeVisible();
    await page.locator("li").filter({ hasText: "GitHub Copilot" }).getByRole("button", { name: "退出" }).click();
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  } finally {
    writeFileSync(authPath, backup);
  }
  await page.getByRole("button", { name: "刷新登录状态" }).click();
  await expect(page.getByText("订阅 / 登录")).toBeVisible();
});
