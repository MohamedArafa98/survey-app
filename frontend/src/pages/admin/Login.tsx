import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Button } from "../../components/Button";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) navigate("/admin", { replace: true });
  }, [user, navigate]);

  if (user) return <Navigate to="/admin" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u) return toast.error(t("auth.login.errors.emptyUsername"));
    if (!password) return toast.error(t("auth.login.errors.emptyPassword"));
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { username: u, password });
      setSession(r.data.token, r.data.user);
      navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t("auth.login.errors.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <Link to="/" className="text-sm text-slate-500 hover:underline">
            ← {t("auth.login.backHome")}
          </Link>
          <LanguageSwitcher />
        </div>
        <form onSubmit={submit} className="card w-full p-8">
          <h2 className="text-2xl font-semibold">{t("auth.login.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("auth.login.subtitle")}</p>

          <div className="mt-6">
            <label className="label">{t("auth.login.username")}</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="mt-4">
            <label className="label">{t("auth.login.password")}</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button pending={loading} className="w-full mt-6">
            {t("auth.login.signIn")}
          </Button>
        </form>
      </div>
    </div>
  );
}
