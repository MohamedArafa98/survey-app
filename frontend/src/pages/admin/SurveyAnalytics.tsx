import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";

/* ---------- types ---------- */

type Survey = {
  id: number;
  title: string;
  period_label: string;
  questions: { id: number; text: string }[];
};

type SavedChart = {
  id: number;
  survey_id: number | null;
  name: string;
  config_json: ChartConfig;
  created_at: string;
};

export type ChartConfig = {
  type: "bar" | "line" | "pie" | "radar";
  metric: "avg" | "count" | "percentage" | "distribution";
  x_axis: "question" | "survey" | "gender" | "occupation" | "age_bucket" | "score" | "category";
  group_by?:
    | "gender"
    | "occupation"
    | "age_bucket"
    | "survey"
    | "question"
    | "score"
    | "category"
    | null;
  filters?: {
    gender?: string[];
    occupation?: string[];
    age_buckets?: string[];
  };
};

export type DefaultKey =
  | "avg_per_question"
  | "distribution"
  | "by_gender"
  | "by_age_bucket"
  | "by_occupation";

export const DEFAULT_NAME_PREFIX = "__default.";

export const DEFAULT_CHARTS: Record<DefaultKey, { title: string; config: ChartConfig }> = {
  avg_per_question: {
    title: "Average score per question",
    config: { type: "bar", metric: "avg", x_axis: "question", group_by: null },
  },
  distribution: {
    title: "Score distribution",
    config: { type: "bar", metric: "count", x_axis: "score", group_by: "question" },
  },
  by_gender: {
    title: "By gender",
    config: { type: "bar", metric: "avg", x_axis: "gender", group_by: null },
  },
  by_age_bucket: {
    title: "By age bucket",
    config: { type: "bar", metric: "avg", x_axis: "age_bucket", group_by: null },
  },
  by_occupation: {
    title: "By occupation",
    config: { type: "bar", metric: "avg", x_axis: "occupation", group_by: null },
  },
};

const DEFAULT_KEYS = Object.keys(DEFAULT_CHARTS) as DefaultKey[];

/* ---------- page ---------- */

export default function SurveyAnalytics() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const sid = Number(id);

  const { data: survey } = useQuery({
    queryKey: ["survey", sid],
    queryFn: async () => (await api.get<Survey>(`/surveys/${sid}`)).data,
  });
  const { data: charts = [] } = useQuery({
    queryKey: ["charts", "all"],
    queryFn: async () => (await api.get<SavedChart[]>("/charts")).data,
  });

  const surveyCharts = charts.filter(
    (c) => c.survey_id === sid && !c.name.startsWith(DEFAULT_NAME_PREFIX),
  );
  const generalCharts = charts.filter(
    (c) => c.survey_id === null && !c.name.startsWith(DEFAULT_NAME_PREFIX),
  );

  if (!survey) return <div className="text-slate-500">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/surveys" className="text-sm text-slate-500 hover:underline">
          ← {t("common.allSurveys")}
        </Link>
        <h1 className="text-2xl font-semibold">
          {t("surveys.analytics.titlePrefix")} · {survey.title}
        </h1>
        <p className="text-sm text-slate-500">{survey.period_label}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {DEFAULT_KEYS.map((k) => (
          <DefaultChartCard
            key={k}
            defaultKey={k}
            surveyId={sid}
            override={
              charts.find((c) => c.survey_id === sid && c.name === DEFAULT_NAME_PREFIX + k) ||
              null
            }
          />
        ))}
      </div>

      <CreateCustomChart surveyId={sid} />

      {surveyCharts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("surveys.analytics.savedCharts")}</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {surveyCharts.map((c) => (
              <SavedChartCard key={c.id} chart={c} surveyId={sid} />
            ))}
          </div>
        </div>
      )}

      {generalCharts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("surveys.analytics.generalCharts")}</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {generalCharts.map((c) => (
              <SavedChartCard key={c.id} chart={c} surveyId={sid} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- default chart card ---------- */

function DefaultChartCard({
  defaultKey,
  surveyId,
  override,
}: {
  defaultKey: DefaultKey;
  surveyId: number;
  override: SavedChart | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const def = DEFAULT_CHARTS[defaultKey];
  const title = t(`surveys.analytics.defaults.${defaultKey}`);
  const config = override?.config_json || def.config;

  const { data } = useQuery({
    queryKey: ["analytics-query", surveyId, config],
    queryFn: async () =>
      (await api.post("/analytics/query", { survey_ids: [surveyId], ...config })).data,
  });

  const option = useMemo(() => buildOption(config, data), [config, data]);

  const reset = useMutation({
    mutationFn: async () => {
      if (!override) return null;
      return (await api.delete(`/charts/${override.id}`)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charts", "all"] });
      toast.success(t("surveys.analytics.toasts.resetDone", { chart: title }));
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || t("surveys.analytics.toasts.resetFailed")),
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">
          {title}
          {override && (
            <span className="ms-2 badge bg-brand-50 text-brand-700">
              {t("surveys.analytics.edited")}
            </span>
          )}
        </h3>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost"
            title={t("surveys.analytics.editChart")}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          {override && (
            <button
              className="btn btn-ghost"
              title={t("surveys.analytics.resetToDefault")}
              onClick={() => {
                if (confirm(t("surveys.analytics.resetConfirm"))) reset.mutate();
              }}
              disabled={reset.isPending}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="h-[320px]">
        {option ? (
          <ReactECharts option={option} style={{ height: "100%" }} notMerge />
        ) : (
          <EmptyExplanation reason={data?.reason} />
        )}
      </div>

      {editing && (
        <EditChartModal
          surveyId={surveyId}
          initial={{
            id: override?.id,
            name: override?.name || DEFAULT_NAME_PREFIX + defaultKey,
            config,
            kind: "default",
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/* ---------- saved chart card ---------- */

function SavedChartCard({ chart, surveyId }: { chart: SavedChart; surveyId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const previewSurveyIds = chart.survey_id ? [chart.survey_id] : [surveyId];

  const { data } = useQuery({
    queryKey: ["analytics-query", previewSurveyIds, chart.config_json],
    queryFn: async () =>
      (
        await api.post("/analytics/query", {
          survey_ids: previewSurveyIds,
          ...chart.config_json,
        })
      ).data,
  });
  const option = useMemo(() => buildOption(chart.config_json, data), [chart.config_json, data]);

  const del = useMutation({
    mutationFn: async () => (await api.delete(`/charts/${chart.id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charts", "all"] });
      toast.success(t("surveys.analytics.toasts.chartDeleted"));
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || t("surveys.analytics.toasts.deleteFailed")),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">
          {chart.name}
          {chart.survey_id === null && (
            <span className="ms-2 badge bg-indigo-50 text-indigo-700">
              {t("surveys.analytics.generalBadge")}
            </span>
          )}
        </h4>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost"
            title={t("common.edit")}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="btn btn-ghost text-red-600"
            onClick={() => {
              if (confirm(t("surveys.analytics.deleteConfirm"))) del.mutate();
            }}
            disabled={del.isPending}
            title={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-[320px]">
        {option ? (
          <ReactECharts option={option} style={{ height: "100%" }} />
        ) : (
          <EmptyExplanation reason={data?.reason} />
        )}
      </div>

      {editing && (
        <EditChartModal
          surveyId={chart.survey_id ?? surveyId}
          initial={{
            id: chart.id,
            name: chart.name,
            config: chart.config_json,
            kind: "saved",
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/* ---------- "create custom chart" entry point ---------- */

function CreateCustomChart({ surveyId }: { surveyId: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end">
      <Button onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> {t("surveys.analytics.newCustomChart")}
      </Button>
      {open && (
        <EditChartModal
          surveyId={surveyId}
          initial={{ name: "", config: DEFAULT_CHARTS.avg_per_question.config, kind: "new" }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------- Edit chart modal (wraps ChartBuilder) ---------- */

type ChartInitial = {
  id?: number;
  name: string;
  config: ChartConfig;
  kind: "new" | "saved" | "default";
};

function EditChartModal({
  surveyId,
  initial,
  onClose,
}: {
  surveyId: number;
  initial: ChartInitial;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50">
      <div className="card p-6 w-full max-w-5xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {initial.kind === "new"
              ? t("surveys.analytics.modal.new")
              : initial.kind === "default"
                ? t("surveys.analytics.modal.default")
                : t("surveys.analytics.modal.saved")}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
        <ChartBuilder surveyId={surveyId} initial={initial} onSaved={onClose} />
      </div>
    </div>
  );
}

/* ---------- Chart builder (power-user, supports create / edit / default) ---------- */

function ChartBuilder({
  surveyId,
  initial,
  onSaved,
}: {
  surveyId: number;
  initial: ChartInitial;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<ChartConfig>(initial.config);
  const [name, setName] = useState(initial.name);

  const { data } = useQuery({
    queryKey: ["analytics-query", surveyId, cfg],
    queryFn: async () =>
      (await api.post("/analytics/query", { survey_ids: [surveyId], ...cfg })).data,
  });
  const option = useMemo(() => buildOption(cfg, data), [cfg, data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        survey_id: initial.kind === "default" ? surveyId : null,
        config_json: cfg,
      };
      if (initial.id) {
        return (await api.patch(`/charts/${initial.id}`, body)).data;
      }
      return (await api.post("/charts", body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charts", "all"] });
      toast.success(
        initial.id
          ? t("surveys.analytics.toasts.chartUpdated")
          : t("surveys.analytics.toasts.chartSaved"),
      );
      onSaved();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || t("surveys.analytics.toasts.saveFailed")),
  });

  function onSave() {
    if (!name.trim()) {
      toast.error(t("surveys.analytics.errors.emptyName"));
      return;
    }
    save.mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex-1">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("surveys.analytics.builder.namePlaceholder")}
          />
          <div className="mt-1 text-xs text-slate-500">
            {initial.kind === "default"
              ? t("surveys.analytics.builder.defaultHint")
              : t("surveys.analytics.builder.generalHint")}
          </div>
        </div>
        <Button pending={save.isPending} onClick={onSave}>
          <Save className="h-4 w-4" /> {t("common.save")}
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <Field label={t("surveys.analytics.builder.chartType")}>
          <select className="input" value={cfg.type} onChange={(e) => setCfg({ ...cfg, type: e.target.value as any })}>
            <option value="bar">{t("surveys.analytics.builder.types.bar")}</option>
            <option value="line">{t("surveys.analytics.builder.types.line")}</option>
            <option value="pie">{t("surveys.analytics.builder.types.pie")}</option>
            <option value="radar">{t("surveys.analytics.builder.types.radar")}</option>
          </select>
        </Field>
        <Field label={t("surveys.analytics.builder.metric")}>
          <select
            className="input"
            value={cfg.metric}
            onChange={(e) => setCfg({ ...cfg, metric: e.target.value as any })}
          >
            <option value="avg">{t("surveys.analytics.builder.metrics.avg")}</option>
            <option value="count">{t("surveys.analytics.builder.metrics.count")}</option>
            <option value="percentage">{t("surveys.analytics.builder.metrics.percentage")}</option>
            <option value="distribution">{t("surveys.analytics.builder.metrics.distribution")}</option>
          </select>
        </Field>
        <Field label={t("surveys.analytics.builder.xAxis")}>
          <select
            className="input"
            value={cfg.x_axis}
            onChange={(e) => setCfg({ ...cfg, x_axis: e.target.value as any })}
          >
            <option value="question">{t("surveys.analytics.builder.xAxes.question")}</option>
            <option value="category">{t("surveys.analytics.builder.xAxes.category")}</option>
            <option value="survey">{t("surveys.analytics.builder.xAxes.survey")}</option>
            <option value="gender">{t("surveys.analytics.builder.xAxes.gender")}</option>
            <option value="occupation">{t("surveys.analytics.builder.xAxes.occupation")}</option>
            <option value="age_bucket">{t("surveys.analytics.builder.xAxes.age_bucket")}</option>
            <option value="score">{t("surveys.analytics.builder.xAxes.score")}</option>
          </select>
        </Field>
        <Field label={t("surveys.analytics.builder.groupBy")}>
          <select
            className="input"
            value={cfg.group_by || ""}
            onChange={(e) => setCfg({ ...cfg, group_by: (e.target.value || null) as any })}
          >
            <option value="">{t("surveys.analytics.builder.groupByNone")}</option>
            <option value="category">{t("surveys.analytics.builder.xAxes.category")}</option>
            <option value="gender">{t("surveys.analytics.builder.xAxes.gender")}</option>
            <option value="occupation">{t("surveys.analytics.builder.xAxes.occupation")}</option>
            <option value="age_bucket">{t("surveys.analytics.builder.xAxes.age_bucket")}</option>
            <option value="survey">{t("surveys.analytics.builder.xAxes.survey")}</option>
            <option value="question">{t("surveys.analytics.builder.xAxes.question")}</option>
            <option value="score">{t("surveys.analytics.builder.xAxes.score")}</option>
          </select>
        </Field>
      </div>

      <div className="h-[420px]">
        {option ? (
          <ReactECharts option={option} style={{ height: "100%" }} notMerge />
        ) : (
          <EmptyExplanation reason={data?.reason} />
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

const EMPTY_REASONS = ["no_surveys", "no_responses", "filtered_out", "empty_groups"] as const;

function EmptyExplanation({ reason }: { reason?: string | null }) {
  const { t } = useTranslation();
  const key =
    reason && (EMPTY_REASONS as readonly string[]).includes(reason)
      ? `surveys.analytics.emptyReasons.${reason}`
      : "surveys.analytics.noData";
  return (
    <div className="h-full grid place-items-center text-sm text-slate-500 text-center px-4">
      {t(key)}
    </div>
  );
}

export function buildOption(cfg: ChartConfig, data: any): EChartsOption | null {
  if (!data || !data.points?.length) return null;
  const points: { x: string; y: number; series?: string }[] = data.points;

  if (cfg.type === "pie") {
    const byX = new Map<string, number>();
    for (const p of points) byX.set(p.x, (byX.get(p.x) || 0) + p.y);
    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0 },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          data: Array.from(byX, ([name, value]) => ({ name, value })),
        },
      ],
    };
  }

  if (cfg.type === "radar") {
    const xs = Array.from(new Set(points.map((p) => p.x)));
    const series = (data.series_names?.length ? data.series_names : [""]) as string[];
    const indicator = xs.map((x) => ({ name: String(x), max: 5 }));
    return {
      tooltip: {},
      legend: { bottom: 0 },
      radar: { indicator },
      series: [
        {
          type: "radar",
          data: series.map((s) => ({
            name: s || "series",
            value: xs.map((x) => {
              const hit = points.find((p) => p.x === x && (p.series || "") === s);
              return hit?.y ?? 0;
            }),
          })),
        },
      ],
    };
  }

  const xs = data.x_labels as string[];
  const seriesNames = (data.series_names?.length ? data.series_names : [""]) as string[];
  const series = seriesNames.map((s) => ({
    name: s || "series",
    type: cfg.type,
    data: xs.map((x) => {
      const hit = points.find((p) => p.x === x && (p.series || "") === s);
      return hit?.y ?? 0;
    }),
  }));
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 40, right: 20, bottom: 70, top: 30 },
    xAxis: { type: "category", data: xs, axisLabel: { rotate: 30 } },
    yAxis: { type: "value" },
    series: series as any,
  };
}
