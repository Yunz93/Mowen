import type { PiResources } from "@mowen/protocol";

type Skill = PiResources["skills"][number];

type Props = {
  skills: Skill[];
  trustProject: boolean;
  onToggle: (path: string, enabled: boolean) => void;
  lastExportPath?: string | null;
  onExport?: () => void;
  onOpenExport?: (path: string) => void;
  onReload?: () => void;
};

export function InspectorSkills({
  skills,
  trustProject,
  onToggle,
  lastExportPath = null,
  onExport,
  onOpenExport,
  onReload,
}: Props) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 flex-1 text-sm ${skills.length === 0 ? "text-mute" : "text-ink"}`}>
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
      {skills.length === 0 ? null : (
        <ul className="overflow-hidden rounded-md border border-line">
          {skills.map((skill) => (
            <li key={skill.path} className="flex min-h-10 items-center gap-2 border-b border-line px-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{skill.name}</p>
                <p className="text-[11px] text-mute">{skill.scope === "user" ? "用户" : "项目"}</p>
              </div>
              <label className="mac-toggle">
                <input
                  type="checkbox"
                  checked={skill.enabled !== false}
                  onChange={(event) => onToggle(skill.path, event.target.checked)}
                  aria-label={skill.enabled === false ? `启用 ${skill.name}` : `停用 ${skill.name}`}
                />
                <span />
              </label>
            </li>
          ))}
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
