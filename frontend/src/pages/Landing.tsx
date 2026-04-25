import { Link } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-100 to-brand-50 p-6">
      <div className="w-full max-w-3xl">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="text-center text-4xl font-bold text-slate-900">{t("landing.title")}</h1>
        <p className="mt-2 text-center text-slate-600">{t("landing.subtitle")}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Link
            to="/admin/login"
            className="card group flex flex-col items-center gap-3 p-10 hover:shadow-md hover:-translate-y-0.5 transition"
          >
            <Shield className="h-12 w-12 text-brand-500" />
            <div className="text-xl font-semibold">{t("landing.admin")}</div>
            <p className="text-sm text-slate-500 text-center">{t("landing.adminDesc")}</p>
          </Link>

          <Link
            to="/guest"
            className="card group flex flex-col items-center gap-3 p-10 hover:shadow-md hover:-translate-y-0.5 transition"
          >
            <Users className="h-12 w-12 text-brand-500" />
            <div className="text-xl font-semibold">{t("landing.guest")}</div>
            <p className="text-sm text-slate-500 text-center">{t("landing.guestDesc")}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
