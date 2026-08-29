import { X } from "lucide-react";

type Props = {
  title: string;
  copy: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmWorkDialog({ title, copy, confirmLabel, onCancel, onConfirm }: Props) {
  return (
    <div className="dialog-scrim z-40">
      <button type="button" className="absolute inset-0" aria-label="关闭" onClick={onCancel} />
      <div
        className="dialog-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-work-title"
        aria-describedby="confirm-work-copy"
      >
        <div className="dialog-head">
          <div className="dialog-head-text">
            <h2 id="confirm-work-title" className="dialog-title">
              {title}
            </h2>
            <p id="confirm-work-copy" className="dialog-copy">
              {copy}
            </p>
          </div>
          <button type="button" className="pressable icon-btn -mr-1 -mt-1" aria-label="关闭" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <div className="dialog-actions">
          <button type="button" className="pressable btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="pressable btn btn-primary" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
