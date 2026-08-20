import type { ApprovalRequest } from "@mypi/protocol";
import { AlertTriangle, CheckCircle2, TerminalSquare } from "lucide-react";

type Props = {
  approval: ApprovalRequest;
  onRespond: (allow: boolean) => void;
};

export function ApprovalSheet({ approval, onRespond }: Props) {
  const remaining = Math.max(0, Date.parse(approval.expiresAt) - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const fileMutation = approval.toolName === "write" || approval.toolName === "edit";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-canvas/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className="w-full max-w-lg rounded-lg bg-elevated p-4 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-canvas text-warn">
            {approval.toolName === "bash" ? <TerminalSquare size={17} /> : <AlertTriangle size={17} />}
          </div>
          <div>
            <h2 id="approval-title" className="text-lg text-ink">
              Allow {approval.toolName}?
            </h2>
            <p className="mt-1 text-sm leading-5 text-mute">{approval.risk}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px]">
          <span className="rounded-md bg-canvas px-2 py-1 text-warn">{approval.toolName === "bash" ? "Runs command" : "Writes file"}</span>
          <span className="rounded-md bg-canvas px-2 py-1 text-mute">Current task</span>
          {fileMutation ? (
            <span className="flex items-center gap-1 rounded-md bg-canvas px-2 py-1 text-accent">
              <CheckCircle2 size={11} /> Path validated
            </span>
          ) : null}
        </div>
        <dl className="mt-4 space-y-2 font-mono text-xs text-ink">
          <div>
            <dt className="text-mute">Working directory</dt>
            <dd className="break-all">{approval.cwd || "—"}</dd>
          </div>
          <div>
            <dt className="text-mute">{approval.toolName === "bash" ? "Command" : "Target"}</dt>
            <dd className="whitespace-pre-wrap break-all">{approval.rawCommand ?? approval.target}</dd>
          </div>
        </dl>
        <p className="mt-3 font-mono text-[11px] text-mute tabular">Expires in {seconds}s</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="pressable h-10 min-w-10 rounded-md px-4 text-sm text-danger"
            onClick={() => onRespond(false)}
          >
            Deny
          </button>
          <button
            type="button"
            className="pressable h-10 min-w-10 rounded-md bg-accent px-4 text-sm text-canvas"
            onClick={() => onRespond(true)}
          >
            Allow once
          </button>
        </div>
      </div>
    </div>
  );
}
