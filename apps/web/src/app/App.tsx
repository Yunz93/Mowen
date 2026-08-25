import { useEffect, useLayoutEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./router";
import { socketClient } from "../transport/socket-client";
import { SetupWizard, type SetupStatus, setupStorePayload } from "../components/setup/SetupWizard";
import { useAgentStore } from "../stores/agent-store";
import { applyTheme, readTheme } from "../lib/theme";
import { getDesktop } from "../desktop-bridge";

export function App() {
  const needsSetup = useAgentStore((state) => state.needsSetup);
  const [checked, setChecked] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useLayoutEffect(() => {
    applyTheme(readTheme());
    const desktop = getDesktop();
    document.documentElement.classList.toggle("desktop", Boolean(desktop));
    if (desktop) {
      document.documentElement.dataset.platform = desktop.platform;
    } else {
      delete document.documentElement.dataset.platform;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/setup", { credentials: "same-origin" });
        if (response.ok) {
          const setup = (await response.json()) as SetupStatus;
          if (!cancelled) {
            useAgentStore.getState().setSetupState(setupStorePayload(setup));
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
            useAgentStore.getState().setSetupState(setupStorePayload(status));
            setShowWizard(false);
            void socketClient.send("snapshot.request");
          }}
        />
      ) : null}
    </BrowserRouter>
  );
}
