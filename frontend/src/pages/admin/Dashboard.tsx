import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Link } from "react-router-dom";
import { FileText, Play, Archive, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";

type Survey = {
  id: number;
  title: string;
  period_label: string;
  state: "draft" | "open" | "closed" | "archived";
  question_count: number;
  response_count: number;
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => (await api.get<Survey[]>("/surveys")).data,
  });

  const total = surveys.length;
  const open = surveys.filter((s) => s.state === "open").length;
  const draft = surveys.filter((s) => s.state === "draft").length;
  const archived = surveys.filter((s) => s.state === "archived").length;

  const tiles = [
    { label: t("dashboard.tiles.total"), value: total, icon: FileText },
    { label: t("dashboard.tiles.open"), value: open, icon: Play },
    { label: t("dashboard.tiles.draft"), value: draft, icon: PenLine },
    { label: t("dashboard.tiles.archived"), value: archived, icon: Archive },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <p className="text-sm text-slate-500">{t("dashboard.subtitle")}</p>
        </div>
        <Link to="/admin/surveys" className="btn btn-primary">
          {t("dashboard.goToSurveys")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-5 flex items-center gap-4">
            <div className="h-12 w-12 grid place-items-center rounded-lg bg-brand-50 text-brand-500">
              <tile.icon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm text-slate-500">{tile.label}</div>
              <div className="text-2xl font-semibold">{tile.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">{t("dashboard.recentSurveys")}</h2>
        <div className="divide-y">
          {surveys.slice(0, 6).map((s) => (
            <Link
              key={s.id}
              to={`/admin/surveys/${s.id}`}
              className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded"
            >
              <div>
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-slate-500">
                  {t("dashboard.meta", {
                    period: s.period_label || t("common.none"),
                    questions: s.question_count,
                    responses: s.response_count,
                  })}
                </div>
              </div>
              <StatePill state={s.state} />
            </Link>
          ))}
          {surveys.length === 0 && (
            <div className="text-sm text-slate-500 py-3">{t("dashboard.emptyState")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatePill({ state }: { state: Survey["state"] }) {
  const { t } = useTranslation();
  const map: Record<Survey["state"], string> = {
    draft: "bg-slate-100 text-slate-700",
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-amber-100 text-amber-700",
    archived: "bg-slate-200 text-slate-600",
  };
  return <span className={`badge ${map[state]}`}>{t(`dashboard.state.${state}`)}</span>;
}
