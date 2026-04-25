import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Button } from "../../components/Button";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export default function FirstRunSetup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 3) return toast.error(t("auth.setup.errors.usernameTooShort"));
    if (password.length < 6) return toast.error(t("auth.setup.errors.passwordTooShort"));
    if (password !== confirm) return toast.error(t("auth.setup.errors.passwordMismatch"));
    setLoading(true);
    try {
      const r = await api.post("/auth/setup", { username: u, password });
      setSession(r.data.token, r.data.user);
      toast.success(t("auth.setup.success"));
      navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t("auth.setup.errors.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <form onSubmit={submit} className="card w-full p-8">
          <h2 className="text-2xl font-semibold">{t("auth.setup.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("auth.setup.subtitle")}</p>

          <div className="mt-6">
            <label className="label">{t("auth.setup.username")}</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="mt-4">
            <label className="label">{t("auth.setup.password")}</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="mt-4">
            <label className="label">{t("auth.setup.confirmPassword")}</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <Button pending={loading} className="w-full mt-6">
            {t("auth.setup.createAdmin")}
          </Button>
        </form>
      </div>
    </div>
  );
}
