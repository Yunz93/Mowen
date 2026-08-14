import { useEffect, useState } from "react";
import { ChevronLeft, Folder } from "lucide-react";
import { isDesktopApp, getDesktop } from "../../desktop-bridge";

export type FolderBrowseResult = {
  cwd: string;
  parent: string | null;
  entries: Array<{ path: string; name: string; kind: "dir" }>;
  roots: string[];
};

type Props = {
  initialPath?: string;
  onSelect: (path: string) => void;
  selectedPath?: string;
};

export function FolderPicker({ initialPath, onSelect, selectedPath }: Props) {
  if (isDesktopApp()) {
    return <NativeFolderPicker initialPath={initialPath} onSelect={onSelect} selectedPath={selectedPath} />;
  }
  return <WebFolderPicker initialPath={initialPath} onSelect={onSelect} selectedPath={selectedPath} />;
}

function NativeFolderPicker({ initialPath, onSelect, selectedPath }: Props) {
  const current = selectedPath || initialPath || "";

  async function choose() {
    const picked = await getDesktop()?.pickFolder(current || undefined);
    if (picked) onSelect(picked);
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <p className="text-sm text-mute">Folder</p>
      <p className="mt-1 break-all font-mono text-[12px] text-ink">{current || "No folder selected"}</p>
      <button
        type="button"
        className="pressable mt-3 h-11 rounded-md bg-accent px-4 text-sm text-canvas"
        onClick={() => void choose()}
      >
        Choose folder…
      </button>
    </div>
  );
}

function WebFolderPicker({ initialPath, onSelect, selectedPath }: Props) {
  const [data, setData] = useState<FolderBrowseResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(path?: string) {
    setLoading(true);
    setError("");
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      const response = await fetch(`/api/folders${query}`, { credentials: "same-origin" });
      const json = (await response.json()) as FolderBrowseResult & { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Could not open that folder.");
        return;
      }
      setData(json);
      onSelect(json.cwd);
    } catch {
      setError("Could not browse folders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(initialPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPath]);

  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          className="pressable inline-flex h-10 w-10 items-center justify-center text-mute disabled:opacity-40"
          disabled={!data?.parent || loading}
          aria-label="Go up one folder"
          onClick={() => data?.parent && void load(data.parent)}
        >
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-mute" title={data?.cwd}>
          {data?.cwd ?? "…"}
        </p>
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {loading ? <p className="px-3 py-2 text-sm text-mute">Loading folders…</p> : null}
        {error ? <p className="px-3 py-2 text-sm text-danger">{error}</p> : null}
        {!loading && data
          ? data.entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`pressable flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm ${
                  selectedPath === entry.path ? "bg-elevated text-accent" : "text-ink"
                }`}
                onClick={() => void load(entry.path)}
              >
                <Folder size={16} className="shrink-0 text-mute" />
                <span className="truncate">{entry.name}</span>
              </button>
            ))
          : null}
        {!loading && data && data.entries.length === 0 ? (
          <p className="px-3 py-2 text-sm text-mute">No subfolders here. Use this folder.</p>
        ) : null}
      </div>
      <div className="border-t border-line px-3 py-2 text-sm text-mute">
        Selected: <span className="font-mono text-[12px] text-ink">{selectedPath || data?.cwd || "—"}</span>
      </div>
    </div>
  );
}
