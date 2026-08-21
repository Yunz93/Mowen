import { useState } from "react";
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [theme, setTheme] = useTheme();

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
          <dt className="text-mute">AI 已连接</dt>
          <dd>
            {authConfigured
              ? configuredProviders.length
                ? configuredProviders.join("、")
                : "已连接"
              : "还没有密钥 — 打开向导粘贴 API Key"}
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
            });
            setWizardOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
