import { getDesktop } from "../desktop-bridge";

export function exportFileUrl(filePath: string): string {
  return `/api/exports?path=${encodeURIComponent(filePath)}`;
}

export async function openExportedFile(filePath: string): Promise<void> {
  const desktop = getDesktop();
  if (desktop?.openPath) {
    const error = await desktop.openPath(filePath);
    if (error) throw new Error(error);
    return;
  }
  window.open(exportFileUrl(filePath), "_blank", "noopener,noreferrer");
}
