import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDesktop } from "../../desktop-bridge";
import { useUpdateStore } from "../../stores/update-store";

export function DesktopMenuBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    void useUpdateStore.getState().check();
  }, []);

  useEffect(() => {
    const desktop = getDesktop();
    if (!desktop) return;
    const stopSetup = desktop.onOpenSetup?.(() => {
      navigate("/settings");
    });
    const stopUpdate = desktop.onCheckUpdate?.(() => {
      void useUpdateStore.getState().check(true);
    });
    return () => {
      stopSetup?.();
      stopUpdate?.();
    };
  }, [navigate]);

  return null;
}
