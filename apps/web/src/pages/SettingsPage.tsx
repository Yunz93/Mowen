import { Link } from "react-router-dom";
import { useAgentStore } from "../stores/agent-store";

export function SettingsPage() {
  const piVersion = useAgentStore((state) => state.piVersion);
  const piError = useAgentStore((state) => state.piError);
  const mutations = useAgentStore((state) => state.mutations);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const dataDir = useAgentStore((state) => state.dataDir);
  const maxProcesses = useAgentStore((state) => state.maxProcesses);

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
        MyPi is local-only. Provider credentials stay in Pi. This screen never shows API keys.
      </p>
      <dl className="mt-8 max-w-xl space-y-4 font-mono text-sm">
        <div>
          <dt className="text-mute">Pi version</dt>
          <dd className="tabular">{piVersion ?? piError ?? "unavailable"}</dd>
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
    </main>
  );
}
