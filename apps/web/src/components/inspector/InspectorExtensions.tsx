import type { PiResources } from "@mowen/protocol";

type Extension = PiResources["extensions"][number];
type Package = PiResources["packages"][number];

type Props = {
  extensions: Extension[];
  packages: Package[];
  trustProject: boolean;
  onToggle: (path: string, enabled: boolean) => void;
  onReload?: () => void;
};

export function InspectorExtensions({ extensions, packages, trustProject, onToggle, onReload }: Props) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 flex-1 text-sm ${extensions.length === 0 ? "text-mute" : "text-ink"}`}>
          {extensions.length === 0
            ? trustProject
              ? "还没有插件。"
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
      {packages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-mute">已安装的包</p>
          <ul className="overflow-hidden rounded-md border border-line">
            {packages.map((item) => (
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
