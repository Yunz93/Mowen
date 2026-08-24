import { useEffect, useLayoutEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./router";
import { socketClient } from "../transport/socket-client";
import { SetupWizard, type SetupStatus } from "../components/setup/SetupWizard";
import { useAgentStore } from "../stores/agent-store";
import { applyTheme, readTheme } from "../lib/theme";

export function App() {
  const needsSetup = useAgentStore((state) => state.needsSetup);
  const [checked, setChecked] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useLayoutEffect(() => {
    applyTheme(readTheme());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/setup", { credentials: "same-origin" });
        if (response.ok) {
          const setup = (await response.json()) as SetupStatus;
          if (!cancelled) {
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
            setShowWizard(setup.needsSetup);
          }
        }
      } catch {
        // Socket connect will surface connection issues.
      } finally {
        if (!cancelled) setChecked(true);
      }
      await socketClient.connect();
    })();
    return () => {
      cancelled = true;
      socketClient.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <AppRouter />
      {checked && (showWizard || needsSetup) ? (
        <SetupWizard
          onFinished={(status) => {
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
            setShowWizard(false);
            void socketClient.send("snapshot.request");
          }}
        />
      ) : null}
    </BrowserRouter>
  );
}
