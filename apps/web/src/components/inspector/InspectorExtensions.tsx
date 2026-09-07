import {
  PRESET_PI_PACKAGES,
  packageSourcesEqual,
  presetPackageInstalled,
  type PiResources,
} from "@qingzhou/protocol";
import { useState } from "react";

type Extension = PiResources["extensions"][number];
type Package = PiResources["packages"][number];

type Props = {
  extensions: Extension[];
  packages: Package[];
  trustProject: boolean;
  onToggle: (path: string, enabled: boolean) => void;
  onReload?: () => void;
  onInstallPresets?: (ids?: string[]) => Promise<void>;
};

export function InspectorExtensions({
  extensions,
  packages,
  trustProject,
  onToggle,
  onReload,
  onInstallPresets,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const missing = PRESET_PI_PACKAGES.filter((item) => !presetPackageInstalled(item, packages, extensions));
  const extraPackages = packages.filter(
    (item) => !PRESET_PI_PACKAGES.some((preset) => packageSourcesEqual(preset.source, item.source)),
  );

  async function install(ids?: string[]) {
    if (!onInstallPresets) return;
    setBusy(ids?.length === 1 ? ids[0]! : "all");
    setError("");
    try {
      await onInstallPresets(ids);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "安装失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 flex-1 text-sm ${extensions.length === 0 ? "text-mute" : "text-ink"}`}>
          {extensions.length === 0
            ? trustProject
              ? "还没有本地插件。"
              : "未信任项目，只显示用户插件。"
            : `${extensions.length} 个插件`}
        </p>
        {onReload ? (
          <button
            type="button"
            className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
            onClick={() => onReload()}
          >
            刷新插件
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] text-mute">推荐插件</p>
            <p className="mt-0.5 text-[11px] text-mute">装上后可用网页搜索、记忆、待办、子代理和 MCP。</p>
          </div>
          {onInstallPresets && missing.length > 0 ? (
            <button
              type="button"
              className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
              disabled={busy !== null}
              onClick={() => void install()}
            >
              {busy === "all" ? "正在安装…" : "安装全部"}
            </button>
          ) : null}
        </div>
        <ul className="overflow-hidden rounded-md border border-line">
          {PRESET_PI_PACKAGES.map((item) => {
            const installed = presetPackageInstalled(item, packages, extensions);
            return (
              <li key={item.id} className="flex items-start gap-2 border-b border-line px-2 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{item.name}</p>
                  <p className="text-[11px] text-mute">{item.summary}</p>
                </div>
                {installed ? (
                  <span className="mt-0.5 shrink-0 text-[11px] text-mute">已安装</span>
                ) : onInstallPresets ? (
                  <button
                    type="button"
                    className="pressable mt-0.5 h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
                    disabled={busy !== null}
                    onClick={() => void install([item.id])}
                    aria-label={`安装 ${item.name}`}
                  >
                    {busy === item.id || busy === "all" ? "正在安装…" : "安装"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>

      {extensions.length === 0 ? null : (
        <ul className="overflow-hidden rounded-md border border-line">
          {extensions.map((item) => (
            <li key={item.path} className="flex min-h-10 items-center gap-2 border-b border-line px-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{item.name}</p>
                <p className="text-[11px] text-mute">{item.scope === "user" ? "用户" : "项目"}</p>
              </div>
              <label className="mac-toggle">
                <input
                  type="checkbox"
                  checked={item.enabled !== false}
                  onChange={(event) => onToggle(item.path, event.target.checked)}
                  aria-label={item.enabled === false ? `启用 ${item.name}` : `停用 ${item.name}`}
                />
                <span />
              </label>
            </li>
          ))}
        </ul>
      )}
      {extraPackages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-mute">已安装的包</p>
          <ul className="overflow-hidden rounded-md border border-line">
            {extraPackages.map((item) => (
              <li
                key={`${item.scope}:${item.source}`}
                className="flex min-h-10 items-center gap-2 border-b border-line px-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{item.source}</p>
                  <p className="text-[11px] text-mute">{item.scope === "user" ? "用户" : "项目"} · 只读</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
