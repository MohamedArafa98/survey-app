import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import {
  BarChart3,
  Download,
  Home,
  LogOut,
  Settings as SettingsIcon,
  FileText,
  Users,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export default function AdminLayout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();

  const nav = [
    { to: "/admin", label: t("nav.dashboard"), icon: Home, end: true },
    { to: "/admin/surveys", label: t("nav.surveys"), icon: FileText, end: false },
    { to: "/admin/export", label: t("nav.export"), icon: Download, end: false },
    { to: "/admin/users", label: t("nav.admins"), icon: Users, end: false },
    { to: "/admin/settings", label: t("nav.settings"), icon: SettingsIcon, end: false },
    { to: "/admin/trash", label: t("nav.trash", "Recycle Bin"), icon: Trash2, end: false },
  ];

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    clear();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-slate-50">
      <aside className="bg-slate-900 text-slate-100 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-6 font-semibold text-lg border-b border-slate-800">
          <BarChart3 className="h-5 w-5 text-brand-500" /> {t("common.appName")}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-brand-500 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 text-sm space-y-3">
          <div className="px-3">
            <LanguageSwitcher variant="dark" />
          </div>
          <div className="px-3 pb-2 text-slate-400">
            <div className="font-medium text-slate-200">{user?.username}</div>
            <div className="text-xs uppercase tracking-wide">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> {t("common.signOut")}
          </button>
        </div>
      </aside>

      <main className="p-8">
        <Outlet />
      </main>
    </div>
  );
}
