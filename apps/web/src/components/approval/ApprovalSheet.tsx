import type { ApprovalRequest } from "@ohmypi/protocol";
import { toolNameLabel } from "../../copy";

type Props = {
  approval: ApprovalRequest;
  onRespond: (allow: boolean) => void;
};

function heading(toolName: string): string {
  if (toolName === "write" || toolName === "edit") return "允许修改文件吗？";
  if (toolName === "bash") return "允许运行这条命令吗？";
  return `允许${toolNameLabel(toolName)}吗？`;
}

export function ApprovalSheet({ approval, onRespond }: Props) {
  const remaining = Math.max(0, Date.parse(approval.expiresAt) - Date.now());
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
      className="mb-3 rounded-3xl border border-line bg-elevated p-4 shadow-xl"
    >
      <h2 id="approval-title" className="text-base text-ink">
        {heading(approval.toolName)}
      </h2>
      <p className="mt-2 text-sm leading-6 text-mute">{approval.risk}</p>
      <dl className="mt-3 space-y-2 text-xs text-ink">
        <div>
          <dt className="text-mute">工作文件夹</dt>
          <dd className="break-all">{approval.cwd || "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">{approval.toolName === "bash" ? "命令" : "目标"}</dt>
          <dd className="whitespace-pre-wrap break-all">{approval.rawCommand ?? approval.target}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[12px] text-mute">{seconds} 秒后自动拒绝</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="pressable h-10 min-w-10 rounded-full px-4 text-sm text-danger"
          onClick={() => onRespond(false)}
        >
          拒绝
        </button>
        <button
          type="button"
          className="pressable h-10 min-w-10 rounded-full bg-accent px-4 text-sm text-canvas"
          onClick={() => onRespond(true)}
        >
          允许这次
        </button>
      </div>
    </div>
  );
}
