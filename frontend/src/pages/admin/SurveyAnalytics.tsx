import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Pencil, RotateCcw, Save, Trash2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import { ConfirmModal } from "../../components/ConfirmModal";

/* ---------- types ---------- */

type Survey = {
  id: number;
  title: string;
  period_label: string;
  questions: { id: number; text: string; category_id: number | null; order_index: number }[];
  categories: { id: number; name: string; order_index: number }[];
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
  metric: "avg" | "count" | "percentage" | "distribution" | "marks_percentage";
  secondary_metric?: "avg" | "count" | "percentage" | "distribution" | "marks_percentage" | null;
  x_axis: "question" | "survey" | "gender" | "occupation" | "age_bucket" | "score" | "category";
  default_key?: string | null;
  is_hidden?: boolean;
  show_labels?: boolean;
  show_legend?: boolean;
  color_theme?: "default" | "ocean" | "sunset" | "high_contrast";
  x_axis_title?: string;
  y_axis_title?: string;
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
  | "marks_percentage_per_question"
  | "marks_percentage_per_category"
  | "distribution"
  | "by_gender"
  | "by_age_bucket"
  | "by_occupation"
  | "gender_distribution"
  | "occupation_distribution"
  | "age_bucket_distribution";

export const DEFAULT_NAME_PREFIX = "__default.";

export const DEFAULT_CHARTS: Record<DefaultKey, { title: string; config: ChartConfig }> = {
  avg_per_question: {
    title: "Average score per question",
    config: { type: "bar", metric: "avg", x_axis: "question", group_by: null },
  },
  marks_percentage_per_question: {
    title: "Total marks per question (%)",
    config: { type: "bar", metric: "marks_percentage", x_axis: "question", group_by: null },
  },
  marks_percentage_per_category: {
    title: "Total marks per category (%)",
    config: { type: "bar", metric: "marks_percentage", x_axis: "category", group_by: null },
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
  gender_distribution: {
    title: "Gender distribution",
    config: { type: "pie", metric: "count", x_axis: "gender", group_by: null },
  },
  occupation_distribution: {
    title: "Occupation distribution",
    config: { type: "pie", metric: "count", x_axis: "occupation", group_by: null },
  },
  age_bucket_distribution: {
    title: "Age bucket distribution",
    config: { type: "pie", metric: "count", x_axis: "age_bucket", group_by: null },
  },
};

const DEFAULT_KEYS = Object.keys(DEFAULT_CHARTS) as DefaultKey[];

/* ---------- page ---------- */

export default function SurveyAnalytics() {
  const { t } = useTranslation();
  const qc = useQueryClient();
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

  const { data: summary } = useQuery({
    queryKey: ["survey-summary", sid],
    queryFn: async () => (await api.get<any>(`/analytics/surveys/${sid}/summary`)).data,
  });

  const surveyCharts = charts.filter(
    (c) => c.survey_id === sid && !(c.config_json as any)?.default_key && !c.name.startsWith(DEFAULT_NAME_PREFIX),
  );
  const generalCharts = charts.filter(
    (c) => c.survey_id === null && !(c.config_json as any)?.default_key && !c.name.startsWith(DEFAULT_NAME_PREFIX),
  );

  if (!survey) return <div className="text-slate-500">{t("common.loading")}</div>;

  const occupations = (summary?.by_occupation || []).map((o: any) => o.occupation) as string[];

  const defaultOverrides = new Map<DefaultKey, SavedChart | null>();
  DEFAULT_KEYS.forEach(k => {
    const override = charts.find(c => c.survey_id === sid && ((c.config_json as any)?.default_key === k || c.name === DEFAULT_NAME_PREFIX + k)) || null;
    defaultOverrides.set(k, override);
  });
  
  const visibleDefaultKeys = DEFAULT_KEYS.filter(k => !defaultOverrides.get(k)?.config_json?.is_hidden);
  const hiddenDefaultKeys = DEFAULT_KEYS.filter(k => defaultOverrides.get(k)?.config_json?.is_hidden);

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

      {visibleDefaultKeys.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {visibleDefaultKeys.map((k) => (
            <DefaultChartCard
              key={k}
              defaultKey={k}
              surveyId={sid}
              override={defaultOverrides.get(k) || null}
            />
          ))}
        </div>
      )}

      {hiddenDefaultKeys.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => {
             // In a real app we might restore them one by one, but for now we can just inform them or restore all
             hiddenDefaultKeys.forEach(k => {
                 const override = defaultOverrides.get(k);
                 if (override) {
                     api.patch(`/charts/${override.id}`, { name: override.name, survey_id: override.survey_id, config_json: { ...override.config_json, is_hidden: false }})
                        .then(() => qc.invalidateQueries({ queryKey: ["charts", "all"] }));
                 }
             });
          }}>
            <EyeOff className="h-4 w-4" /> Restore Hidden Charts ({hiddenDefaultKeys.length})
          </Button>
        </div>
      )}

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

      {occupations.length > 0 && (
        <div className="space-y-4 mt-8 pt-8 border-t">
          <h2 className="text-lg font-semibold">Breakdown by Occupation</h2>
          <div className="space-y-8">
            {occupations.map((occ) => (
              <OccupationBreakdown key={occ} survey={survey} occupation={occ} />
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
  const [resetting, setResetting] = useState(false);

  const def = DEFAULT_CHARTS[defaultKey];
  const title = t(`surveys.analytics.defaults.${defaultKey}`);
  const displayName = override?.name || title;
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

  const hide = useMutation({
    mutationFn: async () => {
      const body = {
        name: override?.name || title,
        survey_id: surveyId,
        config_json: { ...config, default_key: defaultKey, is_hidden: true },
      };
      if (override) {
        return (await api.patch(`/charts/${override.id}`, body)).data;
      }
      return (await api.post("/charts", body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charts", "all"] });
      toast.success("Chart hidden");
    },
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">
          {displayName}
          {override && !override.config_json.is_hidden && (
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
          <button
            className="btn btn-ghost"
            title={t("surveys.analytics.resetToDefault")}
            onClick={(e) => {
              e.currentTarget.blur();
              e.stopPropagation();
              setResetting(true);
            }}
            disabled={!override || reset.isPending}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            className="btn btn-ghost text-slate-400 hover:text-slate-600"
            title="Hide Chart"
            onClick={(e) => {
              e.currentTarget.blur();
              e.stopPropagation();
              hide.mutate();
            }}
            disabled={hide.isPending}
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-[320px]">
        {option ? (
          <ReactECharts option={option} style={{ height: "100%" }} notMerge lazyUpdate={true} />
        ) : (
          <EmptyExplanation reason={data?.reason} />
        )}
      </div>

      {resetting && (
        <ConfirmModal
          title={t("surveys.analytics.resetConfirm")}
          message={title}
          onConfirm={() => {
            reset.mutate();
            setResetting(false);
          }}
          onCancel={() => setResetting(false)}
          pending={reset.isPending}
        />
      )}

      {editing && (
        <EditChartModal
          surveyId={surveyId}
          initial={{
            id: override?.id,
            name: override?.name || title,
            config: override?.config_json || { ...def.config, default_key: defaultKey },
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
  const [deleting, setDeleting] = useState(false);

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
            onClick={(e) => {
              e.currentTarget.blur();
              e.stopPropagation();
              setDeleting(true);
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

      {deleting && (
        <ConfirmModal
          title={t("surveys.analytics.deleteConfirm")}
          message={chart.name}
          onConfirm={() => {
            del.mutate();
            setDeleting(false);
          }}
          onCancel={() => setDeleting(false)}
          pending={del.isPending}
        />
      )}

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
  const [tab, setTab] = useState<"data" | "appearance" | "filters">("data");

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
        config_json: { ...cfg, default_key: initial.kind === "default" ? initial.config.default_key : undefined },
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
      <div className="flex items-center justify-between mb-4 gap-2 border-b border-slate-200 pb-4">
        <div className="flex-1">
          <input
            className="input text-lg font-medium py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("surveys.analytics.builder.namePlaceholder")}
          />
        </div>
        <Button pending={save.isPending} onClick={onSave}>
          <Save className="h-4 w-4" /> {t("common.save")}
        </Button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          className={`py-2 px-4 text-sm font-medium border-b-2 ${tab === "data" ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          onClick={() => setTab("data")}
        >
          Data & Metrics
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium border-b-2 ${tab === "appearance" ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          onClick={() => setTab("appearance")}
        >
          Appearance
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium border-b-2 ${tab === "filters" ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          onClick={() => setTab("filters")}
        >
          Filters
        </button>
      </div>

      {tab === "data" && (
        <div className="grid md:grid-cols-4 gap-4 mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
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
              <option value="marks_percentage">{t("surveys.analytics.builder.metrics.marks_percentage", "Total marks (%)")}</option>
            </select>
          </Field>
          <Field label="Secondary Metric">
             <select
              className="input"
              value={cfg.secondary_metric || ""}
              onChange={(e) => setCfg({ ...cfg, secondary_metric: (e.target.value || null) as any })}
              disabled={cfg.type === "pie" || cfg.type === "radar"}
            >
              <option value="">None</option>
              <option value="avg">{t("surveys.analytics.builder.metrics.avg")}</option>
              <option value="count">{t("surveys.analytics.builder.metrics.count")}</option>
              <option value="percentage">{t("surveys.analytics.builder.metrics.percentage")}</option>
              <option value="marks_percentage">{t("surveys.analytics.builder.metrics.marks_percentage", "Total marks (%)")}</option>
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
      )}

      {tab === "appearance" && (
        <div className="grid md:grid-cols-4 gap-4 mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <Field label="Color Theme">
            <select
              className="input"
              value={cfg.color_theme || "default"}
              onChange={(e) => setCfg({ ...cfg, color_theme: e.target.value as any })}
            >
              <option value="default">Default</option>
              <option value="ocean">Ocean</option>
              <option value="sunset">Sunset</option>
              <option value="high_contrast">High Contrast</option>
            </select>
          </Field>
          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={cfg.show_labels ?? false} onChange={(e) => setCfg({ ...cfg, show_labels: e.target.checked })} />
              Show Data Labels
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={cfg.show_legend !== false} onChange={(e) => setCfg({ ...cfg, show_legend: e.target.checked })} />
              Show Legend
            </label>
          </div>
          <Field label="X-Axis Title">
            <input
              className="input"
              value={cfg.x_axis_title || ""}
              onChange={(e) => setCfg({ ...cfg, x_axis_title: e.target.value })}
              placeholder="e.g. Questions"
            />
          </Field>
          <Field label="Y-Axis Title">
            <input
              className="input"
              value={cfg.y_axis_title || ""}
              onChange={(e) => setCfg({ ...cfg, y_axis_title: e.target.value })}
              placeholder="e.g. Average Score"
            />
          </Field>
        </div>
      )}

      {tab === "filters" && (
        <div className="grid md:grid-cols-3 gap-4 mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <Field label="Filter by Gender">
             <input 
               className="input text-sm" 
               placeholder="e.g. male, female (comma separated)"
               value={cfg.filters?.gender?.join(", ") || ""}
               onChange={e => {
                 const vals = e.target.value.split(",").map(v => v.trim()).filter(Boolean);
                 setCfg({ ...cfg, filters: { ...cfg.filters, gender: vals.length ? vals : undefined } });
               }}
             />
          </Field>
          <Field label="Filter by Occupation">
             <input 
               className="input text-sm" 
               placeholder="e.g. Doctor, Nurse (comma separated)"
               value={cfg.filters?.occupation?.join(", ") || ""}
               onChange={e => {
                 const vals = e.target.value.split(",").map(v => v.trim()).filter(Boolean);
                 setCfg({ ...cfg, filters: { ...cfg.filters, occupation: vals.length ? vals : undefined } });
               }}
             />
          </Field>
          <Field label="Filter by Age Bucket">
             <input 
               className="input text-sm" 
               placeholder="e.g. 18-24, 25-34 (comma separated)"
               value={cfg.filters?.age_buckets?.join(", ") || ""}
               onChange={e => {
                 const vals = e.target.value.split(",").map(v => v.trim()).filter(Boolean);
                 setCfg({ ...cfg, filters: { ...cfg.filters, age_buckets: vals.length ? vals : undefined } });
               }}
             />
          </Field>
        </div>
      )}

      <div className="h-[420px]">
        {option ? (
          <ReactECharts option={option} style={{ height: "100%" }} notMerge lazyUpdate={true} />
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
  const points: { x: string; y: number; y2?: number; series?: string }[] = data.points;

  const colorThemes = {
    ocean: ["#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd"],
    sunset: ["#f97316", "#f43f5e", "#ec4899", "#fb923c", "#fcd34d"],
    high_contrast: ["#000000", "#e11d48", "#2563eb", "#16a34a", "#ca8a04"],
    default: ["#4f46e5", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
  };
  const colors = cfg.color_theme && cfg.color_theme !== "default" ? colorThemes[cfg.color_theme] : colorThemes.default;

  const labelConfig = cfg.show_labels ? { show: true, position: "top" } : { show: false };
  const legendConfig = cfg.show_legend !== false ? { bottom: 0 } : { show: false };

  if (cfg.type === "pie") {
    const byX = new Map<string, number>();
    for (const p of points) byX.set(p.x, (byX.get(p.x) || 0) + p.y);
    return {
      color: colors,
      tooltip: { trigger: "item" },
      legend: legendConfig as any,
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          label: labelConfig as any,
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
      color: colors,
      tooltip: {},
      legend: legendConfig as any,
      radar: { indicator },
      series: [
        {
          type: "radar",
          label: labelConfig as any,
          data: series.map((s) => ({
            name: s || "series",
            value: xs.map((x) => {
              const hit = points.find((p) => String(p.x) === String(x) && (p.series || "") === s);
              return hit?.y ?? 0;
            }),
          })),
        },
      ],
    };
  }

  const xs = data.x_labels as string[];
  const seriesNames = (data.series_names?.length ? data.series_names : [""]) as string[];
  const series: any[] = seriesNames.map((s) => ({
    name: s || "series",
    type: cfg.type,
    label: labelConfig,
    yAxisIndex: 0,
    data: xs.map((x) => {
      const hit = points.find((p) => String(p.x) === String(x) && (p.series || "") === s);
      return hit?.y ?? 0;
    }),
  }));

  // Add secondary metric if available
  if (cfg.secondary_metric) {
    seriesNames.forEach((s) => {
      series.push({
        name: s ? `${s} (Secondary)` : "Secondary",
        type: "line", // Fallback to line for secondary
        label: labelConfig,
        yAxisIndex: 1,
        data: xs.map((x) => {
          const hit = points.find((p) => String(p.x) === String(x) && (p.series || "") === s);
          return hit?.y2 ?? null;
        }),
      });
    });
  }

  return {
    color: colors,
    tooltip: { trigger: "axis" },
    legend: legendConfig as any,
    grid: { left: 50, right: cfg.secondary_metric ? 50 : 20, bottom: cfg.show_legend !== false ? 70 : 40, top: 40 },
    xAxis: { 
      type: "category", 
      data: xs, 
      axisLabel: { rotate: 30 },
      name: cfg.x_axis_title,
      nameLocation: "middle",
      nameGap: 30
    },
    yAxis: cfg.secondary_metric 
      ? [
          { type: "value", name: cfg.y_axis_title },
          { type: "value", name: "Secondary", position: "right", alignTicks: true }
        ]
      : { type: "value", name: cfg.y_axis_title },
    series: series as any,
  };
}

/* ---------- Occupation Breakdown Component ---------- */

function OccupationBreakdown({ survey, occupation }: { survey: Survey; occupation: string }) {
  const { t } = useTranslation();
  
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-query", survey.id, "occupation-breakdown", occupation],
    queryFn: async () =>
      (
        await api.post("/analytics/query", {
          survey_ids: [survey.id],
          type: "bar",
          metric: "count",
          x_axis: "score",
          group_by: "question",
          filters: { occupation: [occupation] },
        })
      ).data,
  });

  if (isLoading) return <div className="text-sm text-slate-500">{t("common.loading")}</div>;
  if (!data || !data.points || data.points.length === 0) return null;

  // Process data: points have { x: score, y: count, series: question text }
  const matrix: Record<string, Record<string, number>> = {};
  data.points.forEach((p: any) => {
    const qText = p.series || "Unknown";
    const score = p.x;
    if (!matrix[qText]) matrix[qText] = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
    matrix[qText][score] = p.y;
  });

  const categoriesMap = new Map(survey.categories.map(c => [c.id, c.name]));
  
  const tableRows = survey.questions
    .map(q => {
      const counts = matrix[q.text] || { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
      const categoryName = q.category_id ? categoriesMap.get(q.category_id) || "Uncategorized" : "Uncategorized";
      return {
        question: q.text,
        category: categoryName,
        counts
      };
    })
    .filter(row => matrix[row.question]); // only include questions that have data for this occupation

  // Sort by category name, then question text
  tableRows.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.question.localeCompare(b.question);
  });

  const chartOption: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: { left: 10, right: 10, bottom: 40, top: 20, containLabel: true },
    xAxis: { 
      type: "category", 
      data: tableRows.map(r => r.question), 
      axisLabel: { width: 100, overflow: 'truncate', rotate: 30 } 
    },
    yAxis: { type: "value" },
    series: ["1", "2", "3", "4", "5"].map(score => ({
      name: score,
      type: "bar",
      label: { show: true, position: 'top', formatter: (params: any) => params.value > 0 ? params.value : '' },
      emphasis: { focus: "series" },
      data: tableRows.map(r => r.counts[score]),
      itemStyle: {
        color: score === "1" ? "#ef4444" : // red
               score === "2" ? "#f97316" : // orange
               score === "3" ? "#eab308" : // yellow
               score === "4" ? "#84cc16" : // lime
               "#22c55e" // green
      }
    })),
  };

  return (
    <div className="card overflow-hidden">
      <div className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-slate-800">{occupation}</h3>
      </div>
      
      <div className="p-6 overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold w-1/4">Category</th>
              <th className="px-4 py-3 font-semibold w-2/4">Question</th>
              <th className="px-4 py-3 font-semibold text-center w-16">5</th>
              <th className="px-4 py-3 font-semibold text-center w-16">4</th>
              <th className="px-4 py-3 font-semibold text-center w-16">3</th>
              <th className="px-4 py-3 font-semibold text-center w-16">2</th>
              <th className="px-4 py-3 font-semibold text-center w-16">1</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tableRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{row.category}</td>
                <td className="px-4 py-3">{row.question}</td>
                <td className="px-4 py-3 text-center">{row.counts["5"]}</td>
                <td className="px-4 py-3 text-center">{row.counts["4"]}</td>
                <td className="px-4 py-3 text-center">{row.counts["3"]}</td>
                <td className="px-4 py-3 text-center">{row.counts["2"]}</td>
                <td className="px-4 py-3 text-center">{row.counts["1"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 pb-6 h-[400px]">
        <ReactECharts option={chartOption} style={{ height: "100%" }} />
      </div>
    </div>
  );
}


