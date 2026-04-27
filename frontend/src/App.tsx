import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";

import Landing from "./pages/Landing";
import AdminLogin from "./pages/admin/Login";
import FirstRunSetup from "./pages/admin/FirstRunSetup";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import SurveyList from "./pages/admin/SurveyList";
import SurveyEditor from "./pages/admin/SurveyEditor";
import SurveyAnalytics from "./pages/admin/SurveyAnalytics";
import SurveyResponses from "./pages/admin/SurveyResponses";
import ExportPage from "./pages/admin/ExportPage";
import AdminUsers from "./pages/admin/AdminUsers";
import Settings from "./pages/admin/Settings";
import RecycleBin from "./pages/admin/RecycleBin";
import SurveyPicker from "./pages/guest/SurveyPicker";
import DemographicsForm from "./pages/guest/DemographicsForm";
import SurveyRunner from "./pages/guest/SurveyRunner";
import { useAuthStore } from "./store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";
import { useDir } from "./hooks/useDir";

function Protected({ children }: { children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  useDir();
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);
  const token = useAuthStore((s) => s.token);

  const { data: bootstrap } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: async () => (await api.get<{ first_run: boolean }>("/bootstrap")).data,
  });

  useEffect(() => {
    if (!token) return;
    api
      .get("/auth/me")
      .then((r) => setSession(token, r.data))
      .catch(() => clear());
  }, [token, setSession, clear]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route
        path="/admin/login"
        element={bootstrap?.first_run ? <Navigate to="/admin/setup" replace /> : <AdminLogin />}
      />
      <Route path="/admin/setup" element={<FirstRunSetup />} />

      <Route
        path="/admin"
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="surveys" element={<SurveyList />} />
        <Route path="surveys/:id" element={<SurveyEditor />} />
        <Route path="surveys/:id/analytics" element={<SurveyAnalytics />} />
        <Route path="surveys/:id/responses" element={<SurveyResponses />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<Settings />} />
        <Route path="trash" element={<RecycleBin />} />
      </Route>

      <Route path="/guest" element={<SurveyPicker />} />
      <Route path="/guest/:id/info" element={<DemographicsForm />} />
      <Route path="/guest/:id/answer" element={<SurveyRunner />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
