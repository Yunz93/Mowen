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
  if (!response.ok) throw new Error("Could not load setup status");
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
      .catch(() => setError("Could not reach MyPi. Is it running?"));
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
        setError(json.error ?? "Could not save API key.");
        return;
      }
      setStatus(json);
      setApiKey("");
      setStep("workspace");
    } catch {
      setError("Could not save API key.");
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
        setError(json.error ?? "Could not save that folder.");
        return;
      }
      setStatus(json);
      onFinished(json);
    } catch {
      setError("Could not save that folder.");
    } finally {
      setBusy(false);
    }
  }

  async function skipAuthForNow() {
    setStep("workspace");
  }

  if (!status && !error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 p-4">
        <p className="text-sm text-mute">Checking your computer…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 p-4">
      <div className="w-full max-w-lg rounded-lg bg-elevated p-5 shadow-xl">
        <p className="text-xs uppercase tracking-[0.16em] text-mute">
          {isDesktopApp() ? "Welcome to MyPi" : "MyPi setup"}
        </p>
        <h1 className="mt-2 text-2xl text-ink">
          {step === "welcome" && "Let’s get you ready"}
          {step === "pi" && (status?.piBundled ? "AI engine missing" : "Install Pi")}
          {step === "auth" && "Connect an AI"}
          {step === "workspace" && "Choose a folder"}
        </h1>

        {step === "welcome" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              {isDesktopApp()
                ? "MyPi is a private chat on this computer. Next we will connect an AI and pick a folder it may use."
                : "MyPi is a simple place to chat with an AI that can help with files on this computer. We will set up three things: Pi, an AI key, and a work folder."}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-mute">
              <li>Paste an API key (it stays on this computer)</li>
              <li>Choose a work folder</li>
              <li>Start chatting — MyPi will ask before changing files</li>
            </ol>
            <button
              type="button"
              className="pressable h-11 rounded-md bg-accent px-4 text-sm text-canvas"
              onClick={() => setStep(status?.piAvailable ? (status.authConfigured ? "workspace" : "auth") : "pi")}
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === "pi" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              {status?.piBundled
                ? "MyPi could not start its built-in AI engine. Try quitting and opening MyPi again. If it still fails, reinstall the app."
                : "Pi is the AI engine MyPi uses. Ask the person who installed MyPi to put Pi on this computer, then click Check again."}
            </p>
            <div className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-[12px] text-mute">
              {status?.piAvailable
                ? `Found Pi ${status.piVersion}`
                : status?.piError ?? "Pi is not installed yet."}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="pressable h-11 rounded-md bg-accent px-4 text-sm text-canvas"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void fetchSetup()
                    .then((next) => {
                      setStatus(next);
                      if (next.piAvailable) setStep(next.authConfigured ? "workspace" : "auth");
                    })
                    .catch(() => setError("Could not check Pi."))
                    .finally(() => setBusy(false));
                }}
              >
                Check again
              </button>
              {status?.piAvailable ? (
                <button
                  type="button"
                  className="pressable h-11 px-4 text-sm text-mute"
                  onClick={() => setStep(status.authConfigured ? "workspace" : "auth")}
                >
                  Continue
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "auth" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              Paste an API key from your AI provider. MyPi saves it only on this computer and never
              shows the full key again.
            </p>
            {status?.configuredProviders.length ? (
              <p className="text-sm text-success">
                Already connected: {status.configuredProviders.join(", ")}
              </p>
            ) : null}
            <label className="block text-sm text-mute" htmlFor="provider">
              Provider
            </label>
            <select
              id="provider"
              className="h-11 w-full rounded-md bg-surface px-3 text-sm text-ink"
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
              API key
            </label>
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              className="h-11 w-full rounded-md bg-surface px-3 font-mono text-sm text-ink"
              value={apiKey}
              placeholder={status?.providers.find((item) => item.id === provider)?.hint ?? "API key"}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="pressable h-11 rounded-md bg-accent px-4 text-sm text-canvas disabled:opacity-50"
                disabled={busy || apiKey.trim().length < 8}
                onClick={() => void saveApiKey()}
              >
                Save key
              </button>
              {status?.authConfigured ? (
                <button
                  type="button"
                  className="pressable h-11 px-4 text-sm text-mute"
                  onClick={() => setStep("workspace")}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="pressable h-11 px-4 text-sm text-mute"
                  onClick={() => void skipAuthForNow()}
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        ) : null}

        {step === "workspace" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mute">
              Pick the folder where MyPi is allowed to work. You can open projects inside this folder
              later.
            </p>
            <FolderPicker
              initialPath={workspace || status?.homeDir}
              selectedPath={workspace}
              onSelect={setWorkspace}
            />
            <button
              type="button"
              className="pressable h-11 rounded-md bg-accent px-4 text-sm text-canvas disabled:opacity-50"
              disabled={busy || !workspace}
              onClick={() => void saveWorkspace()}
            >
              Finish setup
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
