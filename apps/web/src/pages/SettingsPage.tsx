import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAgentStore } from "../stores/agent-store";
import { SetupWizard, type SetupStatus, setupStorePayload } from "../components/setup/SetupWizard";
import { useTheme } from "../hooks/useTheme";
import { socketClient } from "../transport/socket-client";
import { authStatusLabel, mergeAuthCatalog } from "../lib/settings-auth";

type ProviderOption = { id: string; label: string; hint: string };

type PiLatest = {
  current: string | null;
  latest: string | null;
  updateAvailable: boolean;
  canUpdate: boolean;
  piBundled: boolean;
  error: string | null;
};

export function SettingsPage() {
  const piVersion = useAgentStore((state) => state.piVersion);
  const piError = useAgentStore((state) => state.piError);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const dataDir = useAgentStore((state) => state.dataDir);
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
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [oauthProviders, setOauthProviders] = useState<Array<{ id: string; label: string }>>([
    { id: "github", label: "GitHub Copilot" },
    { id: "openai", label: "OpenAI" },
  ]);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [keyBusy, setKeyBusy] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keyNotice, setKeyNotice] = useState("");
  const [piLatest, setPiLatest] = useState<PiLatest | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState("");
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  function applySetup(setup: SetupStatus) {
    setModels({ present: Boolean(setup.hasModelsFile), count: setup.modelCount ?? 0 });
    setCanInstallPi(setup.canInstallPi !== false && !setup.piBundled);
    if (setup.providers?.length) {
      setProviders(setup.providers);
    }
    if (setup.oauthProviders?.length) {
      setOauthProviders(setup.oauthProviders);
    }
    useAgentStore.getState().setSetupState(setupStorePayload(setup));
  }

  useEffect(() => {
    void fetch("/api/setup", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((setup: SetupStatus | null) => {
        if (!setup) return;
        applySetup(setup);
      });
    void fetch("/api/setup/pi-latest", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: PiLatest | null) => {
        if (json) setPiLatest(json);
      })
      .catch(() => {
        /* 打开设置页时检查失败不挡操作，可再点「检查更新」。 */
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
      applySetup(setup);
    } finally {
      setTrustBusy(false);
    }
  }

  async function installPi(force = false) {
    setInstallBusy(true);
    setInstallError("");
    try {
      const response = await fetch("/api/setup/install-pi", {
        method: "POST",
        credentials: "same-origin",
        headers: force ? { "content-type": "application/json" } : undefined,
        body: force ? JSON.stringify({ force: true }) : undefined,
      });
      const json = (await response.json()) as SetupStatus & { error?: string };
      if (!response.ok) {
        setInstallError(json.error ?? "安装 Pi 失败。");
        return;
      }
      applySetup(json);
      void socketClient.send("snapshot.request");
      await checkPiUpdate();
    } catch {
      setInstallError(force ? "更新 Pi 失败。" : "安装 Pi 失败。");
    } finally {
      setInstallBusy(false);
    }
  }

  async function checkPiUpdate() {
    setCheckBusy(true);
    try {
      const response = await fetch("/api/setup/pi-latest", { credentials: "same-origin" });
      const json = (await response.json()) as PiLatest & { error?: string };
      if (!response.ok) {
        setPiLatest({
          current: piVersion,
          latest: null,
          updateAvailable: false,
          canUpdate: canInstallPi,
          piBundled: !canInstallPi,
          error: json.error ?? "检查更新失败。",
        });
        return;
      }
      setPiLatest(json);
      if (json.current !== undefined) {
        useAgentStore.getState().setSetupState({
          ...useAgentStore.getState(),
          piVersion: json.current,
          piAvailable: Boolean(json.current),
        });
      }
    } catch {
      setPiLatest({
        current: piVersion,
        latest: null,
        updateAvailable: false,
        canUpdate: canInstallPi,
        piBundled: !canInstallPi,
        error: "检查更新失败。",
      });
    } finally {
      setCheckBusy(false);
    }
  }

  async function saveApiKey(providerId: string) {
    const apiKey = keyDrafts[providerId] ?? "";
    setKeyBusy(providerId);
    setKeyError("");
    setKeyNotice("");
    try {
      const response = await fetch("/api/setup/api-key", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: providerId, apiKey }),
      });
      const json = (await response.json()) as SetupStatus & { error?: string };
      if (!response.ok) {
        setKeyError(json.error ?? "密钥保存失败。");
        return;
      }
      applySetup(json);
      setKeyDrafts((current) => ({ ...current, [providerId]: "" }));
      const label = providers.find((item) => item.id === providerId)?.label ?? providerId;
      setKeyNotice(`已保存 ${label} 的密钥。`);
      void socketClient.send("snapshot.request");
    } catch {
      setKeyError("密钥保存失败。");
    } finally {
      setKeyBusy("");
    }
  }

  async function refreshAuth() {
    setRefreshBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/setup", { credentials: "same-origin" });
      const setup = (await response.json()) as SetupStatus;
      if (!response.ok) {
        setAuthError("刷新登录状态失败。");
        return;
      }
      applySetup(setup);
      void socketClient.send("snapshot.request");
      setAuthNotice("已刷新登录状态。");
    } catch {
      setAuthError("刷新登录状态失败。");
    } finally {
      setRefreshBusy(false);
    }
  }

  async function logoutProvider(provider: string) {
    setAuthBusy(provider);
    setAuthError("");
    setAuthNotice("");
    try {
      const response = await fetch("/api/setup/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await response.json()) as SetupStatus & { error?: string };
      if (!response.ok) {
        setAuthError(json.error ?? "退出失败。");
        return;
      }
      applySetup(json);
      void socketClient.send("snapshot.request");
      setAuthNotice("已退出登录。");
    } catch {
      setAuthError("退出失败。");
    } finally {
      setAuthBusy("");
    }
  }

  async function loginProvider(provider: string) {
    setAuthBusy(provider);
    setAuthError("");
    setAuthNotice("");
    try {
      const response = await fetch("/api/setup/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await response.json()) as SetupStatus & { error?: string; hint?: string };
      if (!response.ok) {
        setAuthError(json.error ?? "无法打开登录。");
        return;
      }
      applySetup(json);
      setAuthNotice(json.hint ?? "完成登录后点刷新。");
    } catch {
      setAuthError("无法打开登录。");
    } finally {
      setAuthBusy("");
    }
  }

  const catalog = mergeAuthCatalog(oauthProviders, providers, authEntries);
  const engineDetail = piVersion ? `已就绪（Pi ${piVersion}）` : (piError ?? "还没准备好");
  let updateDetail: string | null = null;
  if (piLatest?.error) updateDetail = piLatest.error;
  else if (piLatest?.updateAvailable && piLatest.latest) {
    updateDetail = piLatest.piBundled
      ? `有新版本 ${piLatest.latest}。内置 Pi 会随墨问一起更新。`
      : `有新版本 ${piLatest.latest}`;
  } else if (piLatest && piVersion && !piLatest.updateAvailable && piLatest.latest) {
    updateDetail = "已是最新版本";
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
            墨问只在这台电脑上运行。每个服务商在下面单独登录或粘贴密钥；完整密钥不会显示在这里。
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
            <h2 className="settings-label">认证</h2>
            <ul className="settings-card m-0 list-none p-0">
              {catalog.map((item) => {
                const entry = authEntries.find((auth) => auth.id === item.id);
                const draft = keyDrafts[item.id] ?? "";
                const replacing = entry?.kind === "api_key";
                return (
                  <li key={item.id} className="settings-row flex-col items-stretch gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-ink">{item.label}</p>
                        <p className="mt-0.5 text-[12px] text-mute">{authStatusLabel(entry?.kind)}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {item.oauth && entry?.kind !== "oauth" ? (
                          <button
                            type="button"
                            className="pressable btn btn-ghost"
                            disabled={authBusy === item.id}
                            onClick={() => void loginProvider(item.id)}
                          >
                            {authBusy === item.id ? "正在打开…" : "登录"}
                          </button>
                        ) : null}
                        {entry ? (
                          <button
                            type="button"
                            className="pressable btn btn-ghost"
                            disabled={authBusy === item.id}
                            onClick={() => void logoutProvider(item.id)}
                          >
                            {authBusy === item.id ? "正在退出…" : "退出"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {item.apiKey ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="sr-only" htmlFor={`settings-api-key-${item.id}`}>
                          {item.label} API Key
                        </label>
                        <input
                          id={`settings-api-key-${item.id}`}
                          type="password"
                          autoComplete="off"
                          className="field min-w-0 flex-1 font-mono text-[13px] text-ink"
                          value={draft}
                          placeholder={replacing ? "粘贴新的密钥以替换" : (item.hint ?? "API Key")}
                          onChange={(event) => {
                            const value = event.target.value;
                            setKeyDrafts((current) => ({ ...current, [item.id]: value }));
                            setKeyNotice("");
                            setKeyError("");
                          }}
                        />
                        <button
                          type="button"
                          className="pressable btn btn-primary shrink-0"
                          disabled={keyBusy === item.id || draft.trim().length < 8}
                          onClick={() => void saveApiKey(item.id)}
                        >
                          {keyBusy === item.id ? "正在保存…" : replacing ? "更新密钥" : "保存密钥"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              <li className="settings-row items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="pressable btn btn-ghost"
                    disabled={refreshBusy}
                    onClick={() => void refreshAuth()}
                  >
                    {refreshBusy ? "正在刷新…" : "刷新登录状态"}
                  </button>
                  {authNotice ? <p className="text-[12px] text-success">{authNotice}</p> : null}
                  {authError ? <p className="text-[12px] text-danger">{authError}</p> : null}
                  {keyNotice ? <p className="text-[12px] text-success">{keyNotice}</p> : null}
                  {keyError ? <p className="text-[12px] text-danger">{keyError}</p> : null}
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="settings-label">引擎</h2>
            <div className="settings-card">
              <div className="settings-row items-center">
                <div className="min-w-0 pr-3">
                  <p className="text-[13px] text-ink">AI 引擎</p>
                  <p className="mt-0.5 text-[12px] text-mute">{engineDetail}</p>
                  {updateDetail ? (
                    <p className={`mt-1 text-[12px] ${piLatest?.error ? "text-danger" : "text-mute"}`}>{updateDetail}</p>
                  ) : null}
                  {installError ? <p className="mt-1 text-[12px] text-danger">{installError}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {piVersion ? (
                    <button
                      type="button"
                      className="pressable btn btn-ghost"
                      disabled={checkBusy || installBusy}
                      onClick={() => void checkPiUpdate()}
                    >
                      {checkBusy ? "正在检查…" : "检查更新"}
                    </button>
                  ) : null}
                  {!piVersion && canInstallPi ? (
                    <button
                      type="button"
                      className="pressable btn btn-primary"
                      disabled={installBusy}
                      onClick={() => void installPi(false)}
                    >
                      {installBusy ? "正在安装…" : "安装 Pi"}
                    </button>
                  ) : null}
                  {piLatest?.updateAvailable && piLatest.canUpdate ? (
                    <button
                      type="button"
                      className="pressable btn btn-primary"
                      disabled={installBusy || checkBusy}
                      onClick={() => void installPi(true)}
                    >
                      {installBusy ? "正在更新…" : "更新 Pi"}
                    </button>
                  ) : null}
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
            applySetup(status);
            setWizardOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
