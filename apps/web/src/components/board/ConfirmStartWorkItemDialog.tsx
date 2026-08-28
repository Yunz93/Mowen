import { X } from "lucide-react";

type Props = {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmStartWorkItemDialog({ title, onCancel, onConfirm }: Props) {
  return (
    <div className="dialog-scrim z-40">
      <button type="button" className="absolute inset-0" aria-label="关闭" onClick={onCancel} />
      <div
        className="dialog-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-start-work-item-title"
        aria-describedby="confirm-start-work-item-copy"
      >
        <div className="dialog-head">
          <div className="dialog-head-text">
            <h2 id="confirm-start-work-item-title" className="dialog-title">
              开始执行「{title}」？
            </h2>
            <p id="confirm-start-work-item-copy" className="dialog-copy">
              墨问会打开一个对话，并把这个工作项发给 AI。可能会改文件、跑命令。
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
            开始执行
          </button>
        </div>
      </div>
    </div>
  );
}
