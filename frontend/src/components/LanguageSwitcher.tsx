import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../i18n";

type Variant = "dark" | "light";

export function LanguageSwitcher({ variant = "light" }: { variant?: Variant }) {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? i18n.language
    : "en";

  const baseCls =
    variant === "dark"
      ? "bg-slate-800 text-slate-200 border-slate-700 focus:ring-slate-600"
      : "bg-white text-slate-700 border-slate-200 focus:ring-brand-500";

  return (
    <label className={`inline-flex items-center gap-2 text-sm`} title={t("language.label")}>
      <Languages className="h-4 w-4 opacity-70" aria-hidden />
      <select
        className={`rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 ${baseCls}`}
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label={t("language.label")}
      >
        <option value="en">{t("language.en")}</option>
        <option value="ar">{t("language.ar")}</option>
      </select>
    </label>
  );
}
