import { Plus, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PiStatusRing } from "../status/PiStatusRing";
import { useAgentStore } from "../../stores/agent-store";

type Props = {
  onNewTask: () => void;
};

export function NavRail({ onNewTask }: Props) {
  const tasks = useAgentStore((state) => state.tasks);
  const activeId = useAgentStore((state) => state.activeTaskId);
  const status = tasks.find((task) => task.id === activeId)?.status ?? "stopped";

  return (
    <nav
      className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-line bg-sidebar py-2"
      aria-label="Primary"
    >
      <div className="flex h-10 w-10 items-center justify-center" title="MyPi">
        <PiStatusRing status={status} size={26} />
      </div>
      <button
        type="button"
        className="pressable mt-3 flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-elevated"
        aria-label="New task"
        onClick={onNewTask}
      >
        <Plus size={18} />
      </button>
      <div className="flex-1" />
      <NavLink
        to="/settings"
        aria-label="Settings"
        className="pressable mb-[env(safe-area-inset-bottom)] flex h-10 w-10 items-center justify-center rounded-md text-mute hover:bg-elevated hover:text-ink"
      >
        <Settings size={18} />
      </NavLink>
    </nav>
  );
}
