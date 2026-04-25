import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isRtlLang } from "../../i18n";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

type Survey = {
  id: number;
  title: string;
  description: string;
  period_label: string;
  question_count: number;
};

export default function SurveyPicker() {
  const { t, i18n } = useTranslation();
  const rtl = isRtlLang(i18n.language);
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["public-surveys"],
    queryFn: async () => (await api.get<Survey[]>("/public/surveys")).data,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-brand-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-slate-500 hover:underline">
            ← {t("guest.picker.home")}
          </Link>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-2 text-3xl font-bold">{t("guest.picker.title")}</h1>
        <p className="mt-1 text-slate-600">{t("guest.picker.subtitle")}</p>

        <div className="mt-6 space-y-3">
          {isLoading && <div className="text-slate-500">{t("common.loading")}</div>}
          {surveys.map((s) => (
            <Link
              key={s.id}
              to={`/guest/${s.id}/info`}
              className="card p-5 flex items-center justify-between gap-4 hover:shadow-md transition"
            >
              <div>
                <div className="text-lg font-semibold">{s.title}</div>
                {s.description && <div className="text-sm text-slate-600 mt-1">{s.description}</div>}
                <div className="text-xs text-slate-500 mt-2">
                  {t("guest.picker.meta", {
                    period: s.period_label || t("common.none"),
                    questions: s.question_count,
                  })}
                </div>
              </div>
              <Arrow className="h-6 w-6 text-brand-500 shrink-0" />
            </Link>
          ))}
          {!isLoading && surveys.length === 0 && (
            <div className="card p-8 text-center text-slate-500">{t("guest.picker.empty")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
