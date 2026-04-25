import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  Copy,
  Pencil,
  Play,
  BarChart3,
  Archive,
  Trash2,
  Plus,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { StatePill } from "./Dashboard";
import { Button } from "../../components/Button";

type Survey = {
  id: number;
  title: string;
  description: string;
  period_label: string;
  state: "draft" | "open" | "closed" | "archived";
  created_at: string;
  question_count: number;
  response_count: number;
};

export default function SurveyList() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterState, setFilterState] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");

  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => (await api.get<Survey[]>("/surveys")).data,
  });

  const periods = useMemo(
    () => Array.from(new Set(surveys.map((s) => s.period_label).filter(Boolean))),
    [surveys],
  );

  const filtered = surveys.filter((s) => {
    if (filterState && s.state !== filterState) return false;
    if (filterPeriod && s.period_label !== filterPeriod) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Survey[]>();
    for (const s of filtered) {
      const key = s.period_label || t("surveys.list.noPeriod");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, t]);

  const changeState = useMutation({
    mutationFn: async ({ id, state }: { id: number; state: string }) =>
      (await api.post(`/surveys/${id}/state`, { state })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(
        t("surveys.list.toasts.stateChanged", { state: t(`surveys.list.stateLabel.${vars.state}`) }),
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.list.toasts.stateError")),
  });
  const clone = useMutation({
    mutationFn: async (id: number) => (await api.post(`/surveys/${id}/clone`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("surveys.list.toasts.cloned"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.list.toasts.cloneError")),
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/surveys/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("surveys.list.toasts.deleted"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.list.toasts.deleteError")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("surveys.list.title")}</h1>
          <p className="text-sm text-slate-500">{t("surveys.list.subtitle")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> {t("surveys.list.newSurvey")}
        </button>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">{t("surveys.list.filterState")}</label>
          <select className="input" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">{t("surveys.list.all")}</option>
            <option value="draft">{t("surveys.list.stateLabel.draft")}</option>
            <option value="open">{t("surveys.list.stateLabel.open")}</option>
            <option value="closed">{t("surveys.list.stateLabel.closed")}</option>
            <option value="archived">{t("surveys.list.stateLabel.archived")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("surveys.list.filterPeriod")}</label>
          <select className="input" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
            <option value="">{t("surveys.list.all")}</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {grouped.map(([period, list]) => (
        <div key={period} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{period}</h3>
            <div className="text-xs text-slate-500">
              {t("surveys.list.surveyCount", { count: list.length })}
            </div>
          </div>
          <div className="divide-y">
            {list.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <Link to={`/admin/surveys/${s.id}`} className="font-medium hover:underline truncate">
                      {s.title}
                    </Link>
                    <StatePill state={s.state} />
                  </div>
                  <div className="text-xs text-slate-500">
                    {t("surveys.list.meta", {
                      created: new Date(s.created_at).toLocaleDateString(),
                      questions: s.question_count,
                      responses: s.response_count,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/admin/surveys/${s.id}`}
                    className="btn btn-ghost"
                    title={t("surveys.list.actions.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/admin/surveys/${s.id}/analytics`}
                    className="btn btn-ghost"
                    title={t("surveys.list.actions.analytics")}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/admin/surveys/${s.id}/responses`}
                    className="btn btn-ghost"
                    title={t("surveys.list.actions.viewAnswers")}
                  >
                    <ListChecks className="h-4 w-4" />
                  </Link>
                  {s.state === "draft" && (
                    <button
                      className="btn btn-ghost"
                      title={t("surveys.list.actions.openForGuests")}
                      onClick={() => changeState.mutate({ id: s.id, state: "open" })}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {s.state === "open" && (
                    <button
                      className="btn btn-ghost"
                      title={t("surveys.list.actions.close")}
                      onClick={() => changeState.mutate({ id: s.id, state: "closed" })}
                    >
                      {t("surveys.list.actions.close")}
                    </button>
                  )}
                  {s.state !== "archived" && (
                    <button
                      className="btn btn-ghost"
                      title={t("surveys.list.actions.archive")}
                      onClick={() => changeState.mutate({ id: s.id, state: "archived" })}
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    className="btn btn-ghost"
                    title={t("surveys.list.actions.clone")}
                    onClick={() => clone.mutate(s.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    className="btn btn-ghost text-red-600"
                    title={t("surveys.list.actions.delete")}
                    onClick={() => {
                      if (confirm(t("surveys.list.deleteConfirm"))) del.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {surveys.length === 0 && (
        <div className="card p-10 text-center text-slate-500">{t("surveys.list.empty")}</div>
      )}

      {showCreate && <CreateSurveyModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateSurveyModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const save = useMutation({
    mutationFn: async () =>
      (await api.post("/surveys", { title: title.trim(), period_label: period, description })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("surveys.create.success"));
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.create.error")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("surveys.create.errors.emptyTitle"));
      return;
    }
    save.mutate();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50">
      <form onSubmit={onSubmit} className="card p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold">{t("surveys.create.title")}</h3>
        <div className="mt-4">
          <label className="label">{t("surveys.create.titleField")}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="mt-4">
          <label className="label">{t("surveys.create.periodField")}</label>
          <input
            className="input"
            placeholder={t("surveys.create.periodPlaceholder")}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <label className="label">{t("surveys.create.descriptionField")}</label>
          <textarea
            className="input min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <Button pending={save.isPending}>{t("common.create")}</Button>
        </div>
      </form>
    </div>
  );
}
