import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDesktop } from "../../desktop-bridge";

export function DesktopMenuBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const desktop = getDesktop();
    if (!desktop?.onOpenSetup) return;
    return desktop.onOpenSetup(() => {
      navigate("/settings");
    });
  }, [navigate]);

  return null;
}
