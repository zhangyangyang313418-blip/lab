import { Route, Routes } from "react-router-dom";
import { ConfigPage } from "./pages/ConfigPage";
import { EnvironmentOutlinePage } from "./pages/EnvironmentOutlinePage";
import { HomePage } from "./pages/HomePage";
import { ProjectInputPage } from "./pages/ProjectInputPage";
import { ResultsPage } from "./pages/ResultsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/input" element={<ProjectInputPage />} />
      <Route path="/environment-outline" element={<EnvironmentOutlinePage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/config" element={<ConfigPage />} />
    </Routes>
  );
}
