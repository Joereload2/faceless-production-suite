import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { JobPage } from "./pages/JobPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectPage } from "./pages/ProjectPage";
import { PublishPage } from "./pages/PublishPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/projects/:id" element={<ProjectPage />} />
      <Route path="/projects/:id/publish" element={<PublishPage />} />
      <Route path="/jobs/:id" element={<JobPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
