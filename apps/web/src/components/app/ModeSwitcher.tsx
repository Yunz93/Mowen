import { NavLink } from "react-router-dom";

export function ModeSwitcher() {
  return (
    <div className="seg app-no-drag shrink-0" role="tablist" aria-label="模式">
      <NavLink
        to="/"
        role="tab"
        end
        className={({ isActive }) => `pressable btn ${isActive ? "seg-active" : "text-mute"}`}
      >
        对话
      </NavLink>
      <NavLink
        to="/board"
        role="tab"
        className={({ isActive }) => `pressable btn ${isActive ? "seg-active" : "text-mute"}`}
      >
        工作
      </NavLink>
    </div>
  );
}
