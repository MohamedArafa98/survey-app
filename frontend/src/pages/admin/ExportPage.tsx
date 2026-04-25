import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import { Download } from "lucide-react";
import {
  DEFAULT_CHARTS,
  DEFAULT_NAME_PREFIX,
  type DefaultKey,
  type ChartConfig,
} from "./SurveyAnalytics";

type Survey = {
  id: number;
  title: string;
  period_label: string;
  response_count: number;
};

type SavedChart = {
  id: number;
  name: string;
  survey_id: number | null;
  config_json: ChartConfig;
};

const DEFAULT_KEYS = Object.keys(DEFAULT_CHARTS) as DefaultKey[];

export default function ExportPage() {
  const { t } = useTranslation();
  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => (await api.get<Survey[]>("/surveys")).data,
  });
  const { data: allCharts = [] } = useQuery({
    queryKey: ["charts", "all"],
    queryFn: async () => (await api.get<SavedChart[]>("/charts")).data,
  });

  const customCharts = allCharts.filter((c) => !c.name.startsWith(DEFAULT_NAME_PREFIX));

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [includeRaw, setIncludeRaw] = useState(true);
  const [includeAgg, setIncludeAgg] = useState(true);
  const [includeCmp, setIncludeCmp] = useState(true);
  const [chartsSelected, setChartsSelected] = useState<Set<number>>(new Set());
  const [defaultsSelected, setDefaultsSelected] = useState<Set<DefaultKey>>(new Set());

  function toggleSurvey(id: number) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }
  function toggleChart(id: number) {
    const n = new Set(chartsSelected);
    n.has(id) ? n.delete(id) : n.add(id);
    setChartsSelected(n);
  }
  function toggleDefault(k: DefaultKey) {
    const n = new Set(defaultsSelected);
    n.has(k) ? n.delete(k) : n.add(k);
    setDefaultsSelected(n);
  }

  const mut = useMutation({
    mutationFn: async () => {
      const surveyIds = Array.from(selected);

      const customPayload = customCharts
        .filter((c) => chartsSelected.has(c.id))
        .map((c) => ({
          name: c.name,
          survey_ids: c.survey_id ? [c.survey_id] : surveyIds,
          config_json: c.config_json,
        }));

      const defaultPayload: {
        name: string;
        survey_ids: number[];
        config_json: ChartConfig;
      }[] = [];
      for (const sid of surveyIds) {
        const surveyTitle = surveys.find((s) => s.id === sid)?.title || `Survey ${sid}`;
        for (const key of defaultsSelected) {
          const override = allCharts.find(
            (c) => c.survey_id === sid && c.name === DEFAULT_NAME_PREFIX + key,
          );
          defaultPayload.push({
            name: `${surveyTitle} — ${DEFAULT_CHARTS[key].title}`,
            survey_ids: [sid],
            config_json: override?.config_json || DEFAULT_CHARTS[key].config,
          });
        }
      }

      const res = await api.post(
        "/export/excel",
        {
          survey_ids: surveyIds,
          include_raw: includeRaw,
          include_aggregates: includeAgg,
          include_comparison: includeCmp,
          charts: [...defaultPayload, ...customPayload],
        },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `survey-export-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(t("export.toasts.success")),
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("export.toasts.error")),
  });

  function onExport() {
    if (selected.size === 0) {
      toast.error(t("export.errors.selectAtLeastOne"));
      return;
    }
    const hasSheet = includeRaw || includeAgg || includeCmp;
    const hasChart = chartsSelected.size > 0 || defaultsSelected.size > 0;
    if (!hasSheet && !hasChart) {
      toast.error(t("export.errors.selectAtLeastOneSheet"));
      return;
    }
    mut.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("export.title")}</h1>
        <p className="text-sm text-slate-500">{t("export.subtitle")}</p>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-3">{t("export.surveys")}</h3>
        <div className="space-y-2 max-h-72 overflow-auto">
          {surveys.map((s) => (
            <label key={s.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleSurvey(s.id)}
              />
              <span className="flex-1">
                {s.title}{" "}
                <span className="text-slate-500">
                  · {s.period_label || t("common.none")} · {s.response_count}{" "}
                  {t("export.responsesCountSuffix")}
                </span>
              </span>
            </label>
          ))}
          {surveys.length === 0 && (
            <div className="text-sm text-slate-500">{t("export.noSurveys")}</div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-3">{t("export.sheetsHeader")}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeAgg} onChange={(e) => setIncludeAgg(e.target.checked)} />
          {t("export.includeAgg")}
        </label>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={includeRaw} onChange={(e) => setIncludeRaw(e.target.checked)} />
          {t("export.includeRaw")}
        </label>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={includeCmp} onChange={(e) => setIncludeCmp(e.target.checked)} />
          {t("export.includeCmp")}
        </label>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="font-semibold">{t("export.defaultsHeader")}</h3>
            <p className="text-xs text-slate-500">{t("export.defaultsHint")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={DEFAULT_KEYS.length > 0 && defaultsSelected.size === DEFAULT_KEYS.length}
              onChange={(e) =>
                setDefaultsSelected(e.target.checked ? new Set(DEFAULT_KEYS) : new Set())
              }
            />
            {t("export.selectAll")}
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          {DEFAULT_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={defaultsSelected.has(k)}
                onChange={() => toggleDefault(k)}
              />
              <span>{t(`surveys.analytics.defaults.${k}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="font-semibold">{t("export.customHeader")}</h3>
            <p className="text-xs text-slate-500">{t("export.customHint")}</p>
          </div>
          <label
            className={`flex items-center gap-2 text-sm ${
              customCharts.length === 0 ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              disabled={customCharts.length === 0}
              checked={
                customCharts.length > 0 && chartsSelected.size === customCharts.length
              }
              onChange={(e) =>
                setChartsSelected(
                  e.target.checked ? new Set(customCharts.map((c) => c.id)) : new Set(),
                )
              }
            />
            {t("export.selectAll")}
          </label>
        </div>
        <div className="space-y-2 mt-3">
          {customCharts.map((c) => (
            <label key={c.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={chartsSelected.has(c.id)}
                onChange={() => toggleChart(c.id)}
              />
              <span className="flex-1">
                <b>{c.name}</b>
                <span className="text-slate-500">
                  {" "}
                  · {c.config_json?.type || "bar"} · {c.config_json?.metric || "avg"} ·{" "}
                  x={c.config_json?.x_axis || "—"}
                  {c.config_json?.group_by ? ` · group=${c.config_json.group_by}` : ""}
                </span>
              </span>
            </label>
          ))}
          {customCharts.length === 0 && (
            <div className="text-sm text-slate-500">{t("export.customEmpty")}</div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button pending={mut.isPending} onClick={onExport}>
          <Download className="h-4 w-4" /> {t("export.download")}
        </Button>
      </div>
    </div>
  );
}
