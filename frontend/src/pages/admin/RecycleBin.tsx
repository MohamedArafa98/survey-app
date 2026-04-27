import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ConfirmModal } from "../../components/ConfirmModal";

type DeletedSurvey = {
  id: number;
  title: string;
  created_at: string;
  is_deleted: boolean;
};

type DeletedChart = {
  id: number;
  name: string;
  created_at: string;
  is_deleted: boolean;
};

export default function RecycleBin() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"surveys" | "charts">("surveys");
  const [toHardDelete, setToHardDelete] = useState<{ type: "survey" | "chart"; id: number; name: string } | null>(null);

  const { data: surveys = [], isLoading: loadingSurveys } = useQuery({
    queryKey: ["surveys", "trash"],
    queryFn: async () => (await api.get<DeletedSurvey[]>("/surveys?deleted=true")).data,
  });

  const { data: charts = [], isLoading: loadingCharts } = useQuery({
    queryKey: ["charts", "trash"],
    queryFn: async () => (await api.get<DeletedChart[]>("/charts?deleted=true")).data,
  });

  const restoreSurvey = useMutation({
    mutationFn: async (id: number) => (await api.post(`/surveys/${id}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("trash.restored"));
    },
    onError: () => toast.error(t("trash.restoreFailed")),
  });

  const restoreChart = useMutation({
    mutationFn: async (id: number) => (await api.post(`/charts/${id}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charts"] });
      toast.success(t("trash.restored"));
    },
    onError: () => toast.error(t("trash.restoreFailed")),
  });

  const hardDeleteSurvey = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/surveys/${id}?hard=true`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("trash.deletedPermanently"));
      setToHardDelete(null);
    },
    onError: () => toast.error(t("trash.deleteFailed")),
  });

  const hardDeleteChart = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/charts/${id}?hard=true`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charts"] });
      toast.success(t("trash.deletedPermanently"));
      setToHardDelete(null);
    },
    onError: () => toast.error(t("trash.deleteFailed")),
  });

  const handleHardDelete = () => {
    if (!toHardDelete) return;
    if (toHardDelete.type === "survey") hardDeleteSurvey.mutate(toHardDelete.id);
    else hardDeleteChart.mutate(toHardDelete.id);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{t("trash.title", "Recycle Bin")}</h1>
        <p className="text-sm text-slate-500">{t("trash.subtitle", "Restore deleted surveys and charts or remove them permanently.")}</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${tab === "surveys" ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          onClick={() => setTab("surveys")}
        >
          {t("trash.surveys", "Surveys")} ({surveys.length})
        </button>
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${tab === "charts" ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          onClick={() => setTab("charts")}
        >
          {t("trash.charts", "Charts")} ({charts.length})
        </button>
      </div>

      {tab === "surveys" && (
        <div className="space-y-4">
          {loadingSurveys ? (
            <div className="text-slate-500">{t("common.loading")}</div>
          ) : surveys.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">{t("trash.empty", "No items found in trash.")}</div>
          ) : (
            surveys.map((s) => (
              <div key={s.id} className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <div className="text-xs text-slate-400">Deleted: {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => restoreSurvey.mutate(s.id)} disabled={restoreSurvey.isPending}>
                    <RefreshCcw className="h-4 w-4" /> {t("trash.restore", "Restore")}
                  </button>
                  <button className="btn btn-ghost text-red-600" onClick={() => setToHardDelete({ type: "survey", id: s.id, name: s.title })}>
                    <Trash2 className="h-4 w-4" /> {t("trash.deleteForever", "Delete Forever")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "charts" && (
        <div className="space-y-4">
          {loadingCharts ? (
            <div className="text-slate-500">{t("common.loading")}</div>
          ) : charts.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">{t("trash.empty", "No items found in trash.")}</div>
          ) : (
            charts.map((c) => (
              <div key={c.id} className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <div className="text-xs text-slate-400">Deleted: {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => restoreChart.mutate(c.id)} disabled={restoreChart.isPending}>
                    <RefreshCcw className="h-4 w-4" /> {t("trash.restore", "Restore")}
                  </button>
                  <button className="btn btn-ghost text-red-600" onClick={() => setToHardDelete({ type: "chart", id: c.id, name: c.name })}>
                    <Trash2 className="h-4 w-4" /> {t("trash.deleteForever", "Delete Forever")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {toHardDelete && (
        <ConfirmModal
          title={t("trash.deleteConfirmTitle", "Delete permanently?")}
          message={t("trash.deleteConfirmMessage", "Are you sure you want to permanently delete '{{name}}'? This action cannot be undone.").replace("{{name}}", toHardDelete.name)}
          onConfirm={handleHardDelete}
          onCancel={() => setToHardDelete(null)}
          pending={hardDeleteSurvey.isPending || hardDeleteChart.isPending}
        />
      )}
    </div>
  );
}
