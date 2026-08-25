import { getDesktop } from "../desktop-bridge";

export async function showOsNotification(
  title: string,
  body: string,
  notifyType: "info" | "warning" | "error" = "info",
): Promise<void> {
  try {
    if (typeof document !== "undefined" && document.hasFocus() && notifyType !== "error") {
      return;
    }
    const desktop = getDesktop();
    if (desktop?.notify) {
      await desktop.notify({ title, body });
      return;
    }
    if (typeof Notification === "undefined") return;
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;
    new Notification(title, { body });
  } catch {
    // Notification APIs are optional; the in-app UI still shows the event.
  }
}
