import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentStore } from "../../stores/agent-store";
import { socketClient } from "../../transport/socket-client";

type Props = {
  open: boolean;
  onClose: () => void;
  onNewTask: () => void;
};

export function CommandPalette({ open, onClose, onNewTask }: Props) {
  const tasks = useAgentStore((state) => state.tasks);
  const activeTaskId = useAgentStore((state) => state.activeTaskId);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo(() => {
    const commands = [
      { id: "new", label: "新对话", run: onNewTask },
      { id: "settings", label: "打开设置", run: () => navigate("/settings") },
      {
        id: "compact",
        label: "压缩上下文",
        run: () => activeTaskId && void socketClient.send("session.compact", {}, activeTaskId),
      },
      {
        id: "abort",
        label: "停止回复",
        run: () => activeTaskId && void socketClient.send("agent.abort", {}, activeTaskId),
      },
    ];
    const taskItems = tasks.map((task) => ({
      id: task.id,
      label: `打开 ${task.title}`,
      run: () => void socketClient.send("task.activate", {}, task.id),
    }));
    const q = query.trim().toLowerCase();
    return [...commands, ...taskItems].filter((item) => item.label.toLowerCase().includes(q));
  }, [activeTaskId, navigate, onNewTask, query, tasks]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/70 pt-24">
      <div className="w-full max-w-lg rounded-lg bg-elevated p-2">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索会话和命令"
          aria-label="命令面板"
          className="h-10 w-full bg-transparent px-3 text-sm text-ink"
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="pressable flex h-10 w-full items-center px-3 text-left text-sm text-ink hover:bg-surface"
                onClick={() => {
                  item.run();
                  onClose();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
