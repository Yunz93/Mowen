import { Navigate, Route, Routes } from "react-router-dom";
import { WorkbenchPage } from "../pages/WorkbenchPage";
import { SettingsPage } from "../pages/SettingsPage";
import { BoardPage } from "../pages/BoardPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<WorkbenchPage />} />
      <Route path="/board" element={<BoardPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
