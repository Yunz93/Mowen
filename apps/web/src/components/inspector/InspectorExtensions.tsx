import {
  PRESET_PI_PACKAGES,
  packageSourcesEqual,
  presetExtensionLoaded,
  presetExtensionNames,
  type PiResources,
} from "@qingzhou/protocol";

type Extension = PiResources["extensions"][number];
type Package = PiResources["packages"][number];

type Props = {
  extensions: Extension[];
  packages: Package[];
  claimedIds?: string[];
  trustProject: boolean;
  onToggle: (path: string, enabled: boolean) => void;
  busy?: string | null;
  error?: string;
  onInstallPresets?: (ids?: string[]) => void;
};

function matchingExtension(preset: (typeof PRESET_PI_PACKAGES)[number], extensions: Extension[]): Extension | undefined {
  const names = new Set(presetExtensionNames(preset).map((name) => name.toLowerCase()));
  return extensions.find((item) => names.has(item.name.toLowerCase()));
}

export function InspectorExtensions({
  extensions,
  packages,
  claimedIds = [],
  trustProject,
  onToggle,
  busy = null,
  error = "",
  onInstallPresets,
}: Props) {
  const claimed = new Set(claimedIds);
  const missing = PRESET_PI_PACKAGES.filter(
    (item) => !claimed.has(item.id) && !presetExtensionLoaded(item, extensions),
  );
  const extraExtensions = extensions.filter(
    (item) => !PRESET_PI_PACKAGES.some((preset) => matchingExtension(preset, [item])),
  );
  const extraPackages = packages.filter(
    (item) => !PRESET_PI_PACKAGES.some((preset) => packageSourcesEqual(preset.source, item.source)),
  );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className={`panel-count min-w-0 flex-1 ${extensions.length === 0 && missing.length === 0 ? "panel-count-empty" : ""}`}>
          {extensions.length === 0 && missing.length === PRESET_PI_PACKAGES.length
            ? trustProject
              ? "还没有本地插件。可先装推荐项。"
              : "未信任项目，只显示用户插件。"
            : `${extensions.length} 个插件`}
        </p>
        {onInstallPresets && missing.length > 0 ? (
          <button
            type="button"
            className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
            disabled={busy !== null}
            onClick={() => onInstallPresets()}
          >
            {busy === "all" ? "正在安装…" : `安装推荐（${missing.length}）`}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      <ul className="inset-list">
        {PRESET_PI_PACKAGES.map((item) => {
          const installed = claimed.has(item.id) || presetExtensionLoaded(item, extensions);
          const loaded = matchingExtension(item, extensions);
          return (
            <li key={item.id} className="inset-row inset-row-start">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium leading-snug text-ink">{item.name}</p>
                <p className="text-[11px] text-mute">{item.summary}</p>
              </div>
              {installed ? (
                loaded ? (
                  <label className="mac-toggle mac-toggle-sm mt-0.5">
                    <input
                      type="checkbox"
                      checked={loaded.enabled !== false}
                      onChange={(event) => onToggle(loaded.path, event.target.checked)}
                      aria-label={loaded.enabled === false ? `启用 ${item.name}` : `停用 ${item.name}`}
                    />
                    <span />
                  </label>
                ) : (
                  <span className="mt-0.5 shrink-0 text-[11px] text-mute">已安装</span>
                )
              ) : onInstallPresets ? (
                <button
                  type="button"
                  className="pressable mt-0.5 h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
                  disabled={busy !== null}
                  onClick={() => onInstallPresets([item.id])}
                  aria-label={`安装 ${item.name}`}
                >
                  {busy === item.id || busy === "all" ? "正在安装…" : "安装"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {extraExtensions.length > 0 ? (
        <ul className="inset-list">
          {extraExtensions.map((item) => (
            <li key={item.path} className="inset-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium leading-snug text-ink">{item.name}</p>
                <p className="text-[11px] text-mute">{item.scope === "user" ? "用户" : "项目"}</p>
              </div>
              <label className="mac-toggle mac-toggle-sm">
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
      ) : null}
      {extraPackages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-mute">已安装的包</p>
          <ul className="inset-list">
            {extraPackages.map((item) => (
              <li key={`${item.scope}:${item.source}`} className="inset-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium leading-snug text-ink">{item.source}</p>
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
