import {
  PRESET_PI_PACKAGES,
  packageSourcesEqual,
  presetExtensionNames,
  presetPackageInstalled,
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

function presetRow(
  item: (typeof PRESET_PI_PACKAGES)[number],
  options: {
    claimed: Set<string>;
    extensions: Extension[];
    packages: Package[];
    busy: string | null;
    onToggle: (path: string, enabled: boolean) => void;
    onInstallPresets?: (ids?: string[]) => void;
  },
) {
  const installed =
    options.claimed.has(item.id) || presetPackageInstalled(item, options.packages, options.extensions);
  const loaded = matchingExtension(item, options.extensions);
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
              onChange={(event) => options.onToggle(loaded.path, event.target.checked)}
              aria-label={loaded.enabled === false ? `启用 ${item.name}` : `停用 ${item.name}`}
            />
            <span />
          </label>
        ) : (
          <span className="mt-0.5 shrink-0 text-[11px] text-mute">已安装</span>
        )
      ) : options.onInstallPresets ? (
        <button
          type="button"
          className="pressable mt-0.5 h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
          disabled={options.busy !== null}
          onClick={() => options.onInstallPresets?.([item.id])}
          aria-label={`安装 ${item.name}`}
        >
          {options.busy === item.id || options.busy === "all" ? "正在安装…" : "安装"}
        </button>
      ) : null}
    </li>
  );
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
  const installedPresets = PRESET_PI_PACKAGES.filter(
    (item) => claimed.has(item.id) || presetPackageInstalled(item, packages, extensions),
  );
  const recommended = PRESET_PI_PACKAGES.filter(
    (item) => !claimed.has(item.id) && !presetPackageInstalled(item, packages, extensions),
  );
  const extraExtensions = extensions.filter(
    (item) => !PRESET_PI_PACKAGES.some((preset) => matchingExtension(preset, [item])),
  );
  const extraPackages = packages.filter(
    (item) => !PRESET_PI_PACKAGES.some((preset) => packageSourcesEqual(preset.source, item.source)),
  );
  const rowOptions = { claimed, extensions, packages, busy, onToggle, onInstallPresets };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className={`panel-count min-w-0 flex-1 ${installedPresets.length === 0 && recommended.length === 0 ? "panel-count-empty" : ""}`}>
          {extensions.length === 0 && installedPresets.length === 0
            ? trustProject
              ? "还没有本地插件。可先装推荐项。"
              : "未信任项目，只显示用户插件。"
            : `${installedPresets.length} 个已安装`}
        </p>
        {onInstallPresets && recommended.length > 0 ? (
          <button
            type="button"
            className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
            disabled={busy !== null}
            onClick={() => onInstallPresets()}
          >
            {busy === "all" ? "正在安装…" : `安装推荐（${recommended.length}）`}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      {installedPresets.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-mute">已安装</p>
          <ul className="inset-list">
            {installedPresets.map((item) => presetRow(item, rowOptions))}
          </ul>
        </div>
      ) : null}

      {recommended.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-mute">推荐安装</p>
          <ul className="inset-list">{recommended.map((item) => presetRow(item, rowOptions))}</ul>
        </div>
      ) : null}

      {extraExtensions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-mute">其它插件</p>
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
        </div>
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
