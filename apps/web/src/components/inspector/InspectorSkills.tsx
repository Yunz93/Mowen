import type { PiResources, SkillUpdateItem } from "@qingzhou/protocol";

type Skill = PiResources["skills"][number];

type Props = {
  skills: Skill[];
  trustProject: boolean;
  onToggle: (path: string, enabled: boolean) => void;
  lastExportPath?: string | null;
  onExport?: () => void;
  onOpenExport?: (path: string) => void;
  onReload?: () => void;
  busy?: string | null;
  error?: string;
  updates?: SkillUpdateItem[] | null;
  onCheckUpdates?: () => void;
  onUpdateSkills?: (paths?: string[]) => void;
};

function statusLabel(item: SkillUpdateItem | undefined): string {
  if (!item) return "";
  if (item.error) return item.error;
  if (item.updateAvailable) return "有更新";
  if (item.source === "local") return "本地技能";
  return "已是最新";
}

export function InspectorSkills({
  skills,
  trustProject,
  onToggle,
  lastExportPath = null,
  onExport,
  onOpenExport,
  onReload,
  busy = null,
  error = "",
  updates = null,
  onCheckUpdates,
  onUpdateSkills,
}: Props) {
  const byPath = new Map((updates ?? []).map((item) => [item.path, item]));
  const outdated = (updates ?? []).filter((item) => item.updateAvailable);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className={`panel-count min-w-0 flex-1 ${skills.length === 0 ? "panel-count-empty" : ""}`}>
          {skills.length === 0
            ? trustProject
              ? "还没有技能。"
              : "未信任项目，只显示用户技能。"
            : `${skills.length} 个技能`}
        </p>
        {onReload ? (
          <button
            type="button"
            className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
            onClick={() => onReload()}
          >
            刷新技能
          </button>
        ) : null}
      </div>

      {onCheckUpdates ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] text-mute">系统技能</p>
              <p className="mt-0.5 text-[11px] text-mute">检查用户目录里来自 Git / GitHub 的技能，有更新可以一键装上。</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                className="pressable h-7 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
                disabled={busy !== null}
                onClick={() => onCheckUpdates()}
              >
                {busy === "check" ? "正在检查…" : "检查更新"}
              </button>
              {onUpdateSkills && outdated.length > 0 ? (
                <button
                  type="button"
                  className="pressable h-7 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
                  disabled={busy !== null}
                  onClick={() => onUpdateSkills?.(outdated.map((item) => item.path))}
                >
                  {busy === "all" ? "正在更新…" : "更新全部"}
                </button>
              ) : null}
            </div>
          </div>
          {updates && updates.length === 0 ? <p className="text-[12px] text-mute">没有可检查的系统技能。</p> : null}
          {updates && updates.every((item) => !item.updateAvailable) && updates.length > 0 ? (
            <p className="text-[12px] text-mute">没有可更新的系统技能。</p>
          ) : null}
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        </div>
      ) : null}

      {skills.length === 0 ? null : (
        <ul className="inset-list">
          {skills.map((skill) => {
            const status = byPath.get(skill.path);
            return (
              <li key={skill.path} className="inset-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium leading-snug text-ink">{skill.name}</p>
                  <p className="text-[11px] text-mute">
                    {skill.scope === "user" ? "用户" : "项目"}
                    {status ? ` · ${statusLabel(status)}` : ""}
                  </p>
                </div>
                {status?.updateAvailable && onUpdateSkills ? (
                  <button
                    type="button"
                    className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
                    disabled={busy !== null}
                    onClick={() => onUpdateSkills?.([skill.path])}
                    aria-label={`更新 ${skill.name}`}
                  >
                    {busy === skill.path || busy === "all" ? "正在更新…" : "更新"}
                  </button>
                ) : null}
                <label className="mac-toggle mac-toggle-sm">
                  <input
                    type="checkbox"
                    checked={skill.enabled !== false}
                    onChange={(event) => onToggle(skill.path, event.target.checked)}
                    aria-label={skill.enabled === false ? `启用 ${skill.name}` : `停用 ${skill.name}`}
                  />
                  <span />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {onExport ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="pressable h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
            onClick={() => onExport()}
          >
            导出 HTML
          </button>
          {lastExportPath && onOpenExport ? (
            <button
              type="button"
              className="pressable h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
              onClick={() => onOpenExport(lastExportPath)}
            >
              打开
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
