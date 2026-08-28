import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  projectName: string;
  onCancel: () => void;
  onCreate: (input: { title: string; description: string }) => void;
};

export function NewWorkItemDialog({ projectName, onCancel, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="dialog-scrim z-40">
      <button type="button" className="absolute inset-0" aria-label="关闭" onClick={onCancel} />
      <form
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-work-item-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            setError("请填写任务标题。");
            return;
          }
          onCreate({ title: title.trim(), description: description.trim() });
        }}
      >
        <div className="dialog-head">
          <div className="dialog-head-text">
            <h2 id="new-work-item-title" className="dialog-title">
              新建任务
            </h2>
            <p className="dialog-copy">
              写在「{projectName}」里。执行后可以继续追加，直到你把它闭环。
            </p>
          </div>
          <button type="button" className="pressable icon-btn -mr-1 -mt-1" aria-label="关闭" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body space-y-3">
          <div>
            <label className="block text-sm text-mute" htmlFor="work-item-title">
              标题
            </label>
            <input
              id="work-item-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
              }}
              className="field mt-1 w-full text-sm"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-mute" htmlFor="work-item-description">
              说明
            </label>
            <textarea
              id="work-item-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field mt-1 w-full text-sm"
              rows={4}
              placeholder="可选。执行时会发给 AI。之后还能追加。"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="dialog-actions">
          <button type="button" className="pressable btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="pressable btn btn-primary">
            创建任务
          </button>
        </div>
      </form>
    </div>
  );
}
