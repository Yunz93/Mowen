import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAgentStore } from "../stores/agent-store";
import { SetupWizard, type SetupStatus, setupStorePayload } from "../components/setup/SetupWizard";
import { useTheme } from "../hooks/useTheme";
import { socketClient } from "../transport/socket-client";

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
  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState("");
  const [canInstallPi, setCanInstallPi] = useState(false);

  useEffect(() => {
    void fetch("/api/setup", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((setup: SetupStatus | null) => {
        if (!setup) return;
        setModels({ present: Boolean(setup.hasModelsFile), count: setup.modelCount ?? 0 });
        setCanInstallPi(setup.canInstallPi !== false && !setup.piBundled);
        useAgentStore.getState().setSetupState(setupStorePayload(setup));
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
      useAgentStore.getState().setSetupState(setupStorePayload(setup));
    } finally {
      setTrustBusy(false);
    }
  }

  async function installPi() {
    setInstallBusy(true);
    setInstallError("");
    try {
      const response = await fetch("/api/setup/install-pi", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await response.json()) as SetupStatus & { error?: string };
      if (!response.ok) {
        setInstallError(json.error ?? "安装 Pi 失败。");
        return;
      }
      setCanInstallPi(json.canInstallPi !== false && !json.piBundled);
      useAgentStore.getState().setSetupState(setupStorePayload(json));
      void socketClient.send("snapshot.request");
    } catch {
      setInstallError("安装 Pi 失败。");
    } finally {
      setInstallBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <header className="titlebar app-drag traffic-inline flex items-center gap-2 border-b border-line px-3">
        <Link
          to="/"
          className="pressable app-no-drag inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] text-accent"
        >
          <ChevronLeft size={16} />
          返回对话
        </Link>
        <h1 className="flex-1 text-center text-[13px] font-semibold tracking-tight">设置</h1>
        <span className="w-[72px]" />
      </header>
      <main id="main-content" className="flex-1 overflow-y-auto px-5 py-8">
        <div className="settings-shell space-y-7">
          <p className="px-1 text-[13px] leading-6 text-mute">
            墨问只在这台电脑上运行。API 密钥保存在本地，这里不会显示完整密钥。
          </p>

          <section>
            <h2 className="settings-label">外观</h2>
            <div className="settings-card">
              <div className="settings-row items-center">
                <p className="text-[13px] text-ink">主题</p>
                <div className="seg w-[168px]">
                  {(["light", "dark"] as const).map((value) => (
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
            </div>
          </section>

          <section>
            <h2 className="settings-label">账户与引擎</h2>
            <div className="settings-card">
              <div className="settings-row items-center">
                <div className="min-w-0 pr-3">
                  <p className="text-[13px] text-ink">AI 引擎</p>
                  <p className="mt-0.5 text-[12px] text-mute">
                    {piVersion ? `已就绪（Pi ${piVersion}）` : (piError ?? "还没准备好")}
                  </p>
                  {installError ? <p className="mt-1 text-[12px] text-danger">{installError}</p> : null}
                </div>
                {!piVersion && canInstallPi ? (
                  <button
                    type="button"
                    className="pressable btn btn-primary shrink-0"
                    disabled={installBusy}
                    onClick={() => void installPi()}
                  >
                    {installBusy ? "正在安装…" : "安装 Pi"}
                  </button>
                ) : null}
              </div>
              <div className="settings-row">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">本机 Pi 登录</p>
                  <div className="mt-1 text-[12px] text-mute">
                    {authEntries.length ? (
                      <ul className="space-y-1">
                        {authEntries.map((entry) => (
                          <li key={entry.id} className="text-ink">
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
                  </div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <p className="text-[13px] text-ink">models.json</p>
                  <p className="mt-0.5 text-[12px] text-mute">
                    {models.present ? `已找到${models.count ? ` · ${models.count} 个模型` : ""}` : "未找到。Pi 会用默认模型列表。"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="settings-label">项目</h2>
            <div className="settings-card">
              <div className="settings-row items-center">
                <div className="min-w-0 pr-3">
                  <p className="text-[13px] text-ink">信任当前项目</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-mute">
                    加载这个文件夹里的项目技能和提示。下次启动对话才会生效。墨问仍不会加载项目里的 TypeScript 扩展。
                  </p>
                </div>
                <label className="mac-toggle">
                  <input
                    type="checkbox"
                    checked={trustProject}
                    disabled={trustBusy}
                    onChange={(event) => void toggleTrust(event.target.checked)}
                    aria-label="信任当前项目"
                  />
                  <span />
                </label>
              </div>
              <div className="settings-row">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">工作文件夹</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-mute">
                    {workspaceRoot ?? allowedRoots[0] ?? "—"}
                  </p>
                </div>
              </div>
              <div className="settings-row">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">数据保存在</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-mute">{dataDir}</p>
                </div>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="pressable btn btn-primary"
            onClick={() => setWizardOpen(true)}
          >
            打开设置向导
          </button>
        </div>
      </main>

      {wizardOpen ? (
        <SetupWizard
          onCancel={() => setWizardOpen(false)}
          onFinished={(status: SetupStatus) => {
            useAgentStore.getState().setSetupState(setupStorePayload(status));
            setModels({ present: Boolean(status.hasModelsFile), count: status.modelCount ?? 0 });
            setWizardOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
