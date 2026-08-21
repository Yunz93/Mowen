import { useState } from "react";
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-canvas/70 p-4">
      <form
        className="w-full max-w-md rounded-lg bg-elevated p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!cwd.trim()) {
            setError("请先选择一个文件夹。");
            return;
          }
          onCreate(cwd.trim(), title.trim() || undefined);
        }}
      >
        <h2 className="text-lg text-ink">新对话</h2>
        <p className="mt-1 text-sm text-mute">选一个这个对话可以工作的文件夹。</p>

        {desktop ? null : (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`pressable h-10 rounded-md px-3 text-sm ${mode === "browse" ? "bg-surface text-accent" : "text-mute"}`}
              onClick={() => setMode("browse")}
            >
              浏览
            </button>
            <button
              type="button"
              className={`pressable h-10 rounded-md px-3 text-sm ${mode === "type" ? "bg-surface text-accent" : "text-mute"}`}
              onClick={() => setMode("type")}
            >
              输入路径
            </button>
          </div>
        )}

        {desktop || mode === "browse" ? (
          <div className="mt-3">
            <FolderPicker initialPath={defaultCwd || undefined} selectedPath={cwd} onSelect={setCwd} />
          </div>
        ) : (
          <>
            <label className="mt-4 block text-sm text-mute" htmlFor="task-cwd">
              工作文件夹
            </label>
            <input
              id="task-cwd"
              value={cwd}
              onChange={(event) => {
                setCwd(event.target.value);
                setError("");
              }}
              className="mt-1 h-10 w-full rounded-md bg-surface px-3 font-mono text-sm text-ink"
              required
              autoFocus
            />
          </>
        )}

        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
        <label className="mt-3 block text-sm text-mute" htmlFor="task-title">
          标题
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 h-10 w-full rounded-md bg-surface px-3 text-sm text-ink"
          placeholder="可选"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="pressable h-10 px-3 text-sm text-mute" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="pressable h-10 rounded-md bg-accent px-4 text-sm text-canvas">
            创建对话
          </button>
        </div>
      </form>
    </div>
  );
}
