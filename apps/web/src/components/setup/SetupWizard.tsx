import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
  authEntries?: Array<{ id: string; label: string; kind: "api_key" | "oauth" | "other" }>;
  hasModelsFile?: boolean;
  modelCount?: number;
  trustProject?: boolean;
};

type Props = {
  onFinished: (status: SetupStatus) => void;
  onCancel?: () => void;
};

type Step = "welcome" | "pi" | "auth" | "workspace";

async function fetchSetup(): Promise<SetupStatus> {
  const response = await fetch("/api/setup", { credentials: "same-origin" });
  if (!response.ok) throw new Error("无法加载设置状态");
  return (await response.json()) as SetupStatus;
}

export function SetupWizard({ onFinished, onCancel }: Props) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const existingLogins = status?.authEntries ?? [];
  const hasExistingLogin = existingLogins.length > 0 || Boolean(status?.authConfigured);

  useEffect(() => {
    void fetchSetup()
      .then((next) => {
        setStatus(next);
        setWorkspace(next.workspaceRoot ?? next.allowedRoots[0] ?? next.homeDir);
        setProvider(next.providers[0]?.id ?? "anthropic");
        setStep("welcome");
      })
      .catch(() => setError("连不上墨问。确认应用正在运行。"));
  }, []);

  useEffect(() => {
    if (!onCancel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

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

  function goBack() {
    setError("");
    if (step === "pi") setStep("welcome");
    else if (step === "auth") setStep(status?.piAvailable ? "welcome" : "pi");
    else if (step === "workspace") setStep("auth");
  }

  function goNextFromWelcome() {
    setError("");
    setStep(status?.piAvailable ? "auth" : "pi");
  }

  const titles: Record<Step, string> = {
    welcome: "先花半分钟准备一下",
    pi: status?.piBundled ? "AI 引擎出了点问题" : "需要安装 Pi",
    auth: "连接一个 AI",
    workspace: "选一个工作文件夹",
  };

  if (!status && !error) {
    return (
      <div className="dialog-scrim">
        <p className="text-sm text-mute">正在检查这台电脑…</p>
      </div>
    );
  }

  return (
    <div className="dialog-scrim">
      {onCancel ? (
        <button type="button" className="absolute inset-0" aria-label="关闭" onClick={onCancel} />
      ) : null}
      <div className="dialog-panel dialog-panel-lg" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <div className="dialog-head">
          <div className="dialog-head-text">
            <p className="dialog-kicker">{isDesktopApp() ? "欢迎使用墨问" : "墨问设置"}</p>
            <h1 id="setup-title" className="dialog-title">
              {titles[step]}
            </h1>
          </div>
          {onCancel ? (
            <button type="button" className="pressable icon-btn -mr-1 -mt-1" aria-label="关闭" onClick={onCancel}>
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="dialog-body space-y-4">
          {step === "welcome" ? (
            <>
              <p className="text-sm leading-6 text-mute">
                {isDesktopApp()
                  ? "墨问是这台电脑上的私人对话。接下来粘贴一把密钥，再选一个它可以工作的文件夹。"
                  : "墨问让 AI 帮你处理这台电脑上的文件。我们会准备三件事：Pi、AI 密钥、工作文件夹。"}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-mute">
                <li>使用已有的 Pi 登录，或粘贴一把 API Key</li>
                <li>选一个工作文件夹</li>
                <li>开始聊天 — 改文件前会先问你</li>
              </ol>
            </>
          ) : null}

          {step === "pi" ? (
            <>
              <p className="text-sm leading-6 text-mute">
                {status?.piBundled
                  ? "内置 AI 引擎没能启动。请退出后重新打开墨问。如果还是不行，重新安装一次。"
                  : "Pi 是墨问使用的 AI 引擎。请让帮你安装的人把它装到这台电脑上，然后点「再检查」。"}
              </p>
              <div className="rounded-md border border-line bg-canvas px-3 py-2 text-[12px] text-mute">
                {status?.piAvailable ? `已找到 Pi ${status.piVersion}` : (status?.piError ?? "还没有安装 Pi。")}
              </div>
            </>
          ) : null}

          {step === "auth" ? (
            <>
              <p className="text-sm leading-6 text-mute">
                墨问直接读取本机的 Pi 登录（~/.pi/agent/auth.json），不会再存一份密钥。订阅登录请在终端运行
                <code className="mx-1 font-mono text-ink">pi</code>
                然后输入 <code className="font-mono text-ink">/login</code>，完成后点刷新。
              </p>
              {existingLogins.length ? (
                <ul className="space-y-1 text-sm text-ink">
                  {existingLogins.map((entry) => (
                    <li key={entry.id}>
                      {entry.label}
                      <span className="ml-2 text-mute">
                        {entry.kind === "oauth" ? "订阅 / 登录" : entry.kind === "api_key" ? "API Key" : entry.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : status?.configuredProviders.length ? (
                <p className="text-sm text-success">已经连上：{status.configuredProviders.join("、")}</p>
              ) : (
                <p className="text-sm text-mute">还没有发现本机登录。可以粘贴 API Key，或先去 Pi 里 /login。</p>
              )}
              {status?.hasModelsFile ? (
                <p className="text-sm text-mute">已找到 models.json{status.modelCount ? ` · ${status.modelCount} 个模型` : ""}</p>
              ) : null}
              <div>
                <label className="block text-sm text-mute" htmlFor="provider">
                  服务商
                </label>
                <select
                  id="provider"
                  className="field mt-1 w-full text-sm text-ink"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  {(status?.providers ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-mute" htmlFor="api-key">
                  API Key
                </label>
                <input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  className="field mt-1 w-full font-mono text-sm text-ink"
                  value={apiKey}
                  placeholder={status?.providers.find((item) => item.id === provider)?.hint ?? "API Key"}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
            </>
          ) : null}

          {step === "workspace" ? (
            <>
              <p className="text-sm leading-6 text-mute">
                选一个文件夹，墨问只在这里面工作。之后可以在这个文件夹里打开具体项目。
              </p>
              <FolderPicker
                initialPath={workspace || status?.homeDir}
                selectedPath={workspace}
                onSelect={setWorkspace}
              />
            </>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>

        <div className="dialog-actions">
          {step === "welcome" ? (
            <button type="button" className="pressable btn btn-primary" onClick={goNextFromWelcome}>
              继续
            </button>
          ) : null}

          {step === "pi" ? (
            <>
              <button type="button" className="pressable btn btn-ghost" onClick={goBack}>
                上一步
              </button>
              {status?.piAvailable ? (
                <button
                  type="button"
                  className="pressable btn btn-primary"
                  onClick={() => setStep("auth")}
                >
                  继续
                </button>
              ) : (
                <button
                  type="button"
                  className="pressable btn btn-primary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void fetchSetup()
                      .then((next) => {
                        setStatus(next);
                        if (next.piAvailable) setStep("auth");
                      })
                      .catch(() => setError("检查 Pi 失败。"))
                      .finally(() => setBusy(false));
                  }}
                >
                  再检查
                </button>
              )}
            </>
          ) : null}

          {step === "auth" ? (
            <>
              <button
                type="button"
                className="pressable btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void fetchSetup()
                    .then((next) => {
                      setStatus(next);
                    })
                    .catch(() => setError("刷新登录状态失败。"))
                    .finally(() => setBusy(false));
                }}
              >
                刷新
              </button>
              <button type="button" className="pressable btn btn-ghost" onClick={() => setStep("workspace")}>
                {hasExistingLogin ? "使用已有登录" : "暂时跳过"}
              </button>
              <button
                type="button"
                className="pressable btn btn-primary"
                disabled={busy || apiKey.trim().length < 8}
                onClick={() => void saveApiKey()}
              >
                保存密钥
              </button>
            </>
          ) : null}

          {step === "workspace" ? (
            <>
              <button type="button" className="pressable btn btn-ghost" onClick={goBack}>
                上一步
              </button>
              <button
                type="button"
                className="pressable btn btn-primary"
                disabled={busy || !workspace}
                onClick={() => void saveWorkspace()}
              >
                完成设置
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
