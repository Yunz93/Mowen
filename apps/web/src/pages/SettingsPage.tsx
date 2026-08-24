import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAgentStore } from "../stores/agent-store";
import { SetupWizard, type SetupStatus } from "../components/setup/SetupWizard";
import { useTheme } from "../hooks/useTheme";

export function SettingsPage() {
  const piVersion = useAgentStore((state) => state.piVersion);
  const piError = useAgentStore((state) => state.piError);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const dataDir = useAgentStore((state) => state.dataDir);
  const authConfigured = useAgentStore((state) => state.authConfigured);
  const configuredProviders = useAgentStore((state) => state.configuredProviders);
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);
  const authEntries = useAgentStore((state) => state.authEntries);
  const trustProject = useAgentStore((state) => state.trustProject);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [models, setModels] = useState<{ present: boolean; count: number }>({ present: false, count: 0 });
  const [trustBusy, setTrustBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/setup", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((setup: SetupStatus | null) => {
        if (!setup) return;
        setModels({ present: Boolean(setup.hasModelsFile), count: setup.modelCount ?? 0 });
        useAgentStore.getState().setSetupState({
          needsSetup: setup.needsSetup,
          authConfigured: setup.authConfigured,
          configuredProviders: setup.configuredProviders,
          homeDir: setup.homeDir,
          workspaceRoot: setup.workspaceRoot,
          allowedRoots: setup.allowedRoots,
          authEntries: setup.authEntries,
          trustProject: setup.trustProject,
        });
      });
  }, []);

  async function toggleTrust(next: boolean) {
    setTrustBusy(true);
    try {
      const response = await fetch("/api/setup/trust", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trust: next }),
      });
      if (!response.ok) return;
      const setup = (await response.json()) as SetupStatus;
      useAgentStore.getState().setSetupState({
        needsSetup: setup.needsSetup,
        authConfigured: setup.authConfigured,
        configuredProviders: setup.configuredProviders,
        homeDir: setup.homeDir,
        workspaceRoot: setup.workspaceRoot,
        allowedRoots: setup.allowedRoots,
        authEntries: setup.authEntries,
        trustProject: setup.trustProject,
      });
    } finally {
      setTrustBusy(false);
    }
  }

  return (
    <main id="main-content" className="min-h-dvh bg-canvas px-6 py-8 text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <Link to="/" className="pressable inline-flex h-10 items-center text-sm text-accent">
        返回对话
      </Link>
      <h1 className="mt-6 text-2xl">设置</h1>
      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-mute">
        墨问只在这台电脑上运行。API 密钥保存在本地，这里不会显示完整密钥。
      </p>

      <div className="mt-8 max-w-xl">
        <p className="text-sm text-mute">外观</p>
        <div className="seg mt-2 w-fit min-w-[200px]">
          {(["dark", "light"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`pressable btn ${theme === value ? "seg-active" : "text-mute"}`}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {value === "dark" ? "深色" : "浅色"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="pressable btn btn-primary"
          onClick={() => setWizardOpen(true)}
        >
          打开设置向导
        </button>
      </div>

      <dl className="mt-8 max-w-xl space-y-4 text-sm">
        <div>
          <dt className="text-mute">AI 引擎</dt>
          <dd>{piVersion ? `已就绪（Pi ${piVersion}）` : (piError ?? "还没准备好")}</dd>
        </div>
        <div>
          <dt className="text-mute">本机 Pi 登录</dt>
          <dd>
            {authEntries.length ? (
              <ul className="mt-1 space-y-1">
                {authEntries.map((entry) => (
                  <li key={entry.id}>
                    {entry.label}
                    <span className="ml-2 text-mute">
                      {entry.kind === "oauth" ? "订阅 / 登录" : entry.kind === "api_key" ? "API Key" : entry.kind}
                    </span>
                  </li>
                ))}
              </ul>
            ) : authConfigured ? (
              configuredProviders.length ? configuredProviders.join("、") : "已连接"
            ) : (
              "还没有登录 — 打开向导，或在终端运行 pi 后输入 /login"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-mute">models.json</dt>
          <dd>{models.present ? `已找到${models.count ? ` · ${models.count} 个模型` : ""}` : "未找到。Pi 会用默认模型列表。"}</dd>
        </div>
        <div>
          <dt className="text-mute">信任当前项目</dt>
          <dd>
            <label className="mt-1 flex items-start gap-2 text-ink">
              <input
                type="checkbox"
                checked={trustProject}
                disabled={trustBusy}
                onChange={(event) => void toggleTrust(event.target.checked)}
              />
              <span>
                加载这个文件夹里的项目技能和提示。下次启动对话才会生效。墨问仍不会加载项目里的 TypeScript 扩展。
              </span>
            </label>
          </dd>
        </div>
        <div>
          <dt className="text-mute">工作文件夹</dt>
          <dd className="break-all">{workspaceRoot ?? allowedRoots[0] ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">数据保存在</dt>
          <dd className="break-all">{dataDir}</dd>
        </div>
      </dl>

      {wizardOpen ? (
        <SetupWizard
          onCancel={() => setWizardOpen(false)}
          onFinished={(status: SetupStatus) => {
            useAgentStore.getState().setSetupState({
              needsSetup: status.needsSetup,
              authConfigured: status.authConfigured,
              configuredProviders: status.configuredProviders,
              homeDir: status.homeDir,
              workspaceRoot: status.workspaceRoot,
              allowedRoots: status.allowedRoots,
              authEntries: status.authEntries,
              trustProject: status.trustProject,
            });
            setModels({ present: Boolean(status.hasModelsFile), count: status.modelCount ?? 0 });
            setWizardOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
