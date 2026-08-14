import type { ApprovalRequest } from "@mypi/protocol";

type Props = {
  approval: ApprovalRequest;
  onRespond: (allow: boolean) => void;
};

export function ApprovalSheet({ approval, onRespond }: Props) {
  const remaining = Math.max(0, Date.parse(approval.expiresAt) - Date.now());
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-canvas/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className="w-full max-w-lg rounded-lg bg-elevated p-4 shadow-xl"
      >
        <h2 id="approval-title" className="text-lg text-ink">
          Allow {approval.toolName}?
        </h2>
        <p className="mt-2 text-sm text-mute">{approval.risk}</p>
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
