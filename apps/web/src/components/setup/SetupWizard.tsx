import { useEffect, useState } from "react";
import { FolderPicker } from "./FolderPicker";
import { isDesktopApp } from "../../desktop-bridge";

export type SetupStatus = {
  ready: boolean;
  piAvailable: boolean;
  piVersion: string | null;
  piError: string | null;
  authConfigured: boolean;
  configuredProviders: string[];
  providers: Array<{ id: string; label: string; hint: string }>;
  workspaceRoot: string | null;
  setupCompleted: boolean;
  allowedRoots: string[];
  homeDir: string;
  dataDir: string;
  needsSetup: boolean;
  piBundled?: boolean;
};

type Props = {
  onFinished: (status: SetupStatus) => void;
};

type Step = "welcome" | "pi" | "auth" | "workspace";

async function fetchSetup(): Promise<SetupStatus> {
  const response = await fetch("/api/setup", { credentials: "same-origin" });
  if (!response.ok) throw new Error("无法加载设置状态");
  return (await response.json()) as SetupStatus;
}

export function SetupWizard({ onFinished }: Props) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchSetup()
      .then((next) => {
        setStatus(next);
        setWorkspace(next.workspaceRoot ?? next.allowedRoots[0] ?? next.homeDir);
        setProvider(next.providers[0]?.id ?? "anthropic");
        setStep("welcome");
      })
      .catch(() => setError("连不上 ohMyPi。确认应用正在运行。"));
  }, []);

  async function saveApiKey() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/setup/api-key", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const json = (await response.json()) as SetupStatus & { error?: string };
      if (!response.ok) {
        setError(json.error ?? "密钥保存失败。");
        return;
      }
      setStatus(json);
      setApiKey("");
      setStep("workspace");
    } catch {
      setError("密钥保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkspace() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/setup/workspace", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: workspace }),
      });
      const json = (await response.json()) as SetupStatus & { error?: string };
      if (!response.ok) {
        setError(json.error ?? "文件夹保存失败。");
        return;
      }
      onFinished(json);
    } catch {
      setError("文件夹保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function skipAuthForNow() {
    setStep("workspace");
  }

  if (!status && !error) {
    return (
      <div className="dialog-scrim">
        <p className="text-sm text-mute">正在检查这台电脑…</p>
      </div>
    );
  }

  return (
    <div className="dialog-scrim">
      <div className="dialog-panel dialog-panel-lg">
        <p className="text-xs text-mute">{isDesktopApp() ? "欢迎使用 ohMyPi" : "ohMyPi 设置"}</p>
        <h1 className="dialog-title mt-2 text-2xl">
          {step === "welcome" && "先花半分钟准备一下"}
          {step === "pi" && (status?.piBundled ? "AI 引擎出了点问题" : "需要安装 Pi")}
          {step === "auth" && "连接一个 AI"}
          {step === "workspace" && "选一个工作文件夹"}
        </h1>

        {step === "welcome" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              {isDesktopApp()
                ? "ohMyPi 是这台电脑上的私人对话。接下来粘贴一把密钥，再选一个它可以工作的文件夹。"
                : "ohMyPi 让 AI 帮你处理这台电脑上的文件。我们会准备三件事：Pi、AI 密钥、工作文件夹。"}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-mute">
              <li>粘贴 API Key（只保存在这台电脑）</li>
              <li>选一个工作文件夹</li>
              <li>开始聊天 — 改文件前会先问你</li>
            </ol>
            <div className="dialog-actions">
              <button
                type="button"
                className="pressable btn btn-primary"
                onClick={() => setStep(status?.piAvailable ? (status.authConfigured ? "workspace" : "auth") : "pi")}
              >
                继续
              </button>
            </div>
          </div>
        ) : null}

        {step === "pi" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              {status?.piBundled
                ? "内置 AI 引擎没能启动。请退出后重新打开 ohMyPi。如果还是不行，重新安装一次。"
                : "Pi 是 ohMyPi 使用的 AI 引擎。请让帮你安装的人把它装到这台电脑上，然后点「再检查」。"}
            </p>
            <div className="rounded-md border border-line bg-canvas px-3 py-2 text-[12px] text-mute">
              {status?.piAvailable
                ? `已找到 Pi ${status.piVersion}`
                : status?.piError ?? "还没有安装 Pi。"}
            </div>
            <div className="dialog-actions">
              {status?.piAvailable ? (
                <button
                  type="button"
                  className="pressable btn btn-ghost"
                  onClick={() => setStep(status.authConfigured ? "workspace" : "auth")}
                >
                  继续
                </button>
              ) : null}
              <button
                type="button"
                className="pressable btn btn-primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void fetchSetup()
                    .then((next) => {
                      setStatus(next);
                      if (next.piAvailable) setStep(next.authConfigured ? "workspace" : "auth");
                    })
                    .catch(() => setError("检查 Pi 失败。"))
                    .finally(() => setBusy(false));
                }}
              >
                再检查
              </button>
            </div>
          </div>
        ) : null}

        {step === "auth" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              从 AI 服务商复制一把 API Key 贴过来。ohMyPi 只会保存在这台电脑上，之后也不会再显示完整密钥。
            </p>
            {status?.configuredProviders.length ? (
              <p className="text-sm text-success">已经连上：{status.configuredProviders.join("、")}</p>
            ) : null}
            <label className="block text-sm text-mute" htmlFor="provider">
              服务商
            </label>
            <select
              id="provider"
              className="field w-full text-sm text-ink"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            >
              {(status?.providers ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <label className="block text-sm text-mute" htmlFor="api-key">
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              className="field w-full font-mono text-sm text-ink"
              value={apiKey}
              placeholder={status?.providers.find((item) => item.id === provider)?.hint ?? "API Key"}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <div className="dialog-actions">
              {status?.authConfigured ? (
                <button type="button" className="pressable btn btn-ghost" onClick={() => setStep("workspace")}>
                  继续
                </button>
              ) : (
                <button type="button" className="pressable btn btn-ghost" onClick={() => void skipAuthForNow()}>
                  暂时跳过
                </button>
              )}
              <button
                type="button"
                className="pressable btn btn-primary disabled:opacity-50"
                disabled={busy || apiKey.trim().length < 8}
                onClick={() => void saveApiKey()}
              >
                保存密钥
              </button>
            </div>
          </div>
        ) : null}

        {step === "workspace" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              选一个文件夹，ohMyPi 只在这里面工作。之后可以在这个文件夹里打开具体项目。
            </p>
            <FolderPicker
              initialPath={workspace || status?.homeDir}
              selectedPath={workspace}
              onSelect={setWorkspace}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="pressable btn btn-primary disabled:opacity-50"
                disabled={busy || !workspace}
                onClick={() => void saveWorkspace()}
              >
                完成设置
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
