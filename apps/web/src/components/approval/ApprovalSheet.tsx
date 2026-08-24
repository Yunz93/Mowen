import { useState } from "react";
import type { ApprovalRequest } from "@mowen/protocol";
import { toolNameLabel } from "../../copy";
import { DiffView } from "../diff/DiffView";

type Props = {
  approval: ApprovalRequest;
  onRespond: (allow: boolean, remember: boolean) => void;
};

function heading(toolName: string): string {
  if (toolName === "write" || toolName === "edit") return "允许修改文件吗？";
  if (toolName === "bash") return "允许运行这条命令吗？";
  return `允许${toolNameLabel(toolName)}吗？`;
}

export function ApprovalSheet({ approval, onRespond }: Props) {
  const [remember, setRemember] = useState(false);
  const remaining = Math.max(0, Date.parse(approval.expiresAt) - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const hasDiff = Boolean(approval.oldText || approval.newText || approval.content);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
      className="dialog-panel mb-3 max-w-none shadow-dialog"
    >
      <div className="dialog-head">
        <div className="dialog-head-text">
          <h2 id="approval-title" className="dialog-title">
            {heading(approval.toolName)}
          </h2>
          <p className="dialog-copy">{approval.risk}</p>
        </div>
      </div>
      <div className="dialog-body">
        <dl className="space-y-3 text-xs text-ink">
          <div>
            <dt className="text-mute">工作文件夹</dt>
            <dd className="mt-1 break-all font-mono text-[12px]">{approval.cwd || "—"}</dd>
          </div>
          <div>
            <dt className="text-mute">{approval.toolName === "bash" ? "命令" : "目标"}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-all font-mono text-[12px]">
              {approval.rawCommand ?? approval.target}
            </dd>
          </div>
        </dl>
        {hasDiff ? (
          <div className="mt-3">
            <p className="mb-1 text-[12px] text-mute">将要写入的内容</p>
            <DiffView oldText={approval.oldText} newText={approval.newText} content={approval.content} />
          </div>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-[12px] text-ink">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          记住这次（同样的路径或命令不再问）
        </label>
        <p className="mt-3 text-[12px] text-mute">{seconds} 秒后自动拒绝</p>
      </div>
      <div className="dialog-actions dialog-actions-split">
        <button type="button" className="pressable btn btn-danger" onClick={() => onRespond(false, false)}>
          拒绝
        </button>
        <button type="button" className="pressable btn btn-primary" onClick={() => onRespond(true, remember)}>
          允许这次
        </button>
      </div>
    </div>
  );
}
