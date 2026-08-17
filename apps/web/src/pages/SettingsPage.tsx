import { useState } from "react";
import { Link } from "react-router-dom";
import { useAgentStore } from "../stores/agent-store";
import { SetupWizard, type SetupStatus } from "../components/setup/SetupWizard";

export function SettingsPage() {
  const piVersion = useAgentStore((state) => state.piVersion);
  const piError = useAgentStore((state) => state.piError);
  const mutations = useAgentStore((state) => state.mutations);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const dataDir = useAgentStore((state) => state.dataDir);
  const maxProcesses = useAgentStore((state) => state.maxProcesses);
  const authConfigured = useAgentStore((state) => state.authConfigured);
  const configuredProviders = useAgentStore((state) => state.configuredProviders);
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <main id="main-content" className="min-h-dvh bg-canvas px-6 py-8 text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Link to="/" className="pressable inline-flex h-10 items-center text-sm text-accent">
        Back to workbench
      </Link>
      <h1 className="mt-6 text-2xl">Settings</h1>
      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-mute">
        ohMyPi stays on this computer. API keys are saved for Pi and are never shown in full here.
      </p>

      <div className="mt-6">
        <button
          type="button"
          className="pressable h-11 rounded-md bg-accent px-4 text-sm text-canvas"
          onClick={() => setWizardOpen(true)}
        >
          Open setup
        </button>
      </div>

      <dl className="mt-8 max-w-xl space-y-4 font-mono text-sm">
        <div>
          <dt className="text-mute">Pi version</dt>
          <dd className="tabular">{piVersion ?? piError ?? "unavailable"}</dd>
        </div>
        <div>
          <dt className="text-mute">AI connected</dt>
          <dd>
            {authConfigured
              ? configuredProviders.length
                ? configuredProviders.join(", ")
                : "yes"
              : "no — open setup to paste a key"}
          </dd>
        </div>
        <div>
          <dt className="text-mute">Work folder</dt>
          <dd className="break-all">{workspaceRoot ?? allowedRoots[0] ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Mutations</dt>
          <dd>{mutations}</dd>
        </div>
        <div>
          <dt className="text-mute">Allowed roots</dt>
          <dd className="break-all">{allowedRoots.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-mute">Data directory</dt>
          <dd className="break-all">{dataDir}</dd>
        </div>
        <div>
          <dt className="text-mute">Max Pi processes</dt>
          <dd className="tabular">{maxProcesses}</dd>
        </div>
      </dl>

      {wizardOpen ? (
        <SetupWizard
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
