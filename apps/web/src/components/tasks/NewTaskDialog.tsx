import { useState } from "react";

type Props = {
  defaultCwd: string;
  onCancel: () => void;
  onCreate: (cwd: string, title?: string) => void;
};

export function NewTaskDialog({ defaultCwd, onCancel, onCreate }: Props) {
  const [cwd, setCwd] = useState(defaultCwd);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-canvas/70 p-4">
      <form
        className="w-full max-w-md rounded-lg bg-elevated p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!cwd.trim()) {
            setError("Working directory is required.");
            return;
          }
          onCreate(cwd.trim(), title.trim() || undefined);
        }}
      >
        <h2 className="text-lg text-ink">New task</h2>
        <label className="mt-4 block text-sm text-mute" htmlFor="task-cwd">
          Working directory
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
        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
        <label className="mt-3 block text-sm text-mute" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 h-10 w-full rounded-md bg-surface px-3 text-sm text-ink"
          placeholder="Optional"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="pressable h-10 px-3 text-sm text-mute" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="pressable h-10 rounded-md bg-accent px-4 text-sm text-canvas">
            Create task
          </button>
        </div>
      </form>
    </div>
  );
}
