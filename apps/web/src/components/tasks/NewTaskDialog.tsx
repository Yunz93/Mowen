import { useState } from "react";
import { X } from "lucide-react";
import { FolderPicker } from "../setup/FolderPicker";
import { isDesktopApp } from "../../desktop-bridge";

type Props = {
  defaultCwd: string;
  onCancel: () => void;
  onCreate: (cwd: string, title?: string) => void;
};

export function NewTaskDialog({ defaultCwd, onCancel, onCreate }: Props) {
  const desktop = isDesktopApp();
  const [cwd, setCwd] = useState(defaultCwd);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"browse" | "type">("browse");

  return (
    <div className="dialog-scrim z-40">
      <button type="button" className="absolute inset-0" aria-label="关闭" onClick={onCancel} />
      <form
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!cwd.trim()) {
            setError("请先选择一个文件夹。");
            return;
          }
          onCreate(cwd.trim(), title.trim() || undefined);
        }}
      >
        <div className="dialog-head">
          <div className="dialog-head-text">
            <h2 id="new-task-title" className="dialog-title">
              新对话
            </h2>
            <p className="dialog-copy">选一个这个对话可以工作的文件夹。</p>
          </div>
          <button type="button" className="pressable icon-btn -mr-1 -mt-1" aria-label="关闭" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        <div className="dialog-body space-y-3">
          {desktop ? null : (
            <div className="seg">
              <button
                type="button"
                className={`pressable btn ${mode === "browse" ? "seg-active" : "text-mute"}`}
                onClick={() => setMode("browse")}
              >
                浏览
              </button>
              <button
                type="button"
                className={`pressable btn ${mode === "type" ? "seg-active" : "text-mute"}`}
                onClick={() => setMode("type")}
              >
                输入路径
              </button>
            </div>
          )}

          {desktop || mode === "browse" ? (
            <FolderPicker initialPath={defaultCwd || undefined} selectedPath={cwd} onSelect={setCwd} />
          ) : (
            <div>
              <label className="block text-sm text-mute" htmlFor="task-cwd">
                工作文件夹
              </label>
              <input
                id="task-cwd"
                value={cwd}
                onChange={(event) => {
                  setCwd(event.target.value);
                  setError("");
                }}
                className="field mt-1 w-full font-mono text-sm"
                required
                autoFocus
              />
            </div>
          )}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div>
            <label className="block text-sm text-mute" htmlFor="task-title">
              标题
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="field mt-1 w-full text-sm"
              placeholder="可选"
            />
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="pressable btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="pressable btn btn-primary">
            创建对话
          </button>
        </div>
      </form>
    </div>
  );
}
