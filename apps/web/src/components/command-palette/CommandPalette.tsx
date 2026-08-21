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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
    <div className="dialog-scrim items-start pt-[12vh]">
      <button type="button" className="absolute inset-0" aria-label="关闭" onClick={onClose} />
      <div className="dialog-panel dialog-panel-cmd" role="dialog" aria-modal="true" aria-label="命令面板">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索会话和命令"
          aria-label="命令面板"
          className="h-11 w-full bg-transparent px-3 text-sm text-ink placeholder:text-mute"
        />
        <ul className="mt-1 max-h-72 overflow-auto border-t border-line pt-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="pressable hover-fill flex h-10 w-full items-center rounded-md px-3 text-left text-sm text-ink"
                onClick={() => {
                  item.run();
                  onClose();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="px-3 py-3 text-sm text-mute">没有匹配的命令</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
