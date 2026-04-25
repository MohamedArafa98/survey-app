import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";

type AgeBucket = { label: string; min: number; max: number };

export default function Settings() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: occupations = [] } = useQuery({
    queryKey: ["occupations"],
    queryFn: async () => (await api.get<string[]>("/settings/occupations")).data,
  });
  const { data: buckets = [] } = useQuery({
    queryKey: ["age-buckets"],
    queryFn: async () => (await api.get<AgeBucket[]>("/settings/age-buckets")).data,
  });
  const { data: allowOther } = useQuery({
    queryKey: ["allow-other-occupation"],
    queryFn: async () =>
      (await api.get<{ enabled: boolean }>("/settings/allow-other-occupation")).data,
  });

  const [occs, setOccs] = useState<string[]>([]);
  const [bks, setBks] = useState<AgeBucket[]>([]);
  useEffect(() => setOccs(occupations), [occupations]);
  useEffect(() => setBks(buckets), [buckets]);

  const saveOccs = useMutation({
    mutationFn: async (cleaned: string[]) =>
      (await api.put("/settings/occupations", { occupations: cleaned })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occupations"] });
      toast.success(t("settings.occupations.saved"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("settings.occupations.saveFailed")),
  });
  const saveBuckets = useMutation({
    mutationFn: async () => (await api.put("/settings/age-buckets", { buckets: bks })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["age-buckets"] });
      toast.success(t("settings.buckets.saved"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("settings.buckets.saveFailed")),
  });
  const toggleOther = useMutation({
    mutationFn: async (enabled: boolean) =>
      (await api.put("/settings/allow-other-occupation", { enabled })).data,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["allow-other-occupation"] });
      toast.success(
        d.enabled ? t("settings.occupations.toggleOnMessage") : t("settings.occupations.toggleOffMessage"),
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("settings.occupations.toggleFailed")),
  });

  function onSaveOccs() {
    const trimmed = occs.map((o) => o.trim());
    const hasEmpty = trimmed.some((o) => !o);
    if (hasEmpty) {
      toast.error(t("settings.occupations.errors.emptyEntry"));
      return;
    }
    const seen = new Set<string>();
    for (const o of trimmed) {
      const key = o.toLowerCase();
      if (seen.has(key)) {
        toast.error(t("settings.occupations.errors.duplicate", { name: o }));
        return;
      }
      seen.add(key);
    }
    if (trimmed.length === 0) {
      toast.error(t("settings.occupations.errors.empty"));
      return;
    }
    saveOccs.mutate(trimmed);
  }

  function onSaveBuckets() {
    for (const b of bks) {
      if (!b.label.trim()) {
        toast.error(t("settings.buckets.errors.emptyLabel"));
        return;
      }
      if (b.min > b.max) {
        toast.error(t("settings.buckets.errors.badRange", { label: b.label }));
        return;
      }
    }
    for (let i = 0; i < bks.length; i++) {
      for (let j = i + 1; j < bks.length; j++) {
        const a = bks[i];
        const b = bks[j];
        if (a.min <= b.max && b.min <= a.max) {
          toast.error(t("settings.buckets.errors.overlap", { a: a.label, b: b.label }));
          return;
        }
      }
    }
    saveBuckets.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="text-sm text-slate-500">{t("settings.subtitle")}</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("settings.occupations.title")}</h3>
          <Button pending={saveOccs.isPending} onClick={onSaveOccs}>
            <Save className="h-4 w-4" /> {t("common.save")}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
          <input
            type="checkbox"
            checked={allowOther?.enabled ?? true}
            onChange={(e) => toggleOther.mutate(e.target.checked)}
            disabled={toggleOther.isPending}
          />
          {t("settings.occupations.allowOther")}
        </label>
        <div className="space-y-2">
          {occs.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                value={o}
                onChange={(e) => setOccs(occs.map((x, j) => (i === j ? e.target.value : x)))}
              />
              <button
                className="btn btn-ghost text-red-600"
                onClick={() => setOccs(occs.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost mt-3" onClick={() => setOccs([...occs, ""])}>
          <Plus className="h-4 w-4" /> {t("common.add")}
        </button>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("settings.buckets.title")}</h3>
          <Button pending={saveBuckets.isPending} onClick={onSaveBuckets}>
            <Save className="h-4 w-4" /> {t("common.save")}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mb-3">{t("settings.buckets.hint")}</p>
        <div className="space-y-2">
          {bks.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-center">
              <input
                className="input"
                value={b.label}
                placeholder={t("settings.buckets.labelPlaceholder")}
                onChange={(e) => setBks(bks.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))}
              />
              <input
                type="number"
                className="input"
                value={b.min}
                onChange={(e) => setBks(bks.map((x, j) => (i === j ? { ...x, min: +e.target.value } : x)))}
              />
              <input
                type="number"
                className="input"
                value={b.max}
                onChange={(e) => setBks(bks.map((x, j) => (i === j ? { ...x, max: +e.target.value } : x)))}
              />
              <button
                className="btn btn-ghost text-red-600"
                onClick={() => setBks(bks.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost mt-3"
          onClick={() => setBks([...bks, { label: "new", min: 0, max: 0 }])}
        >
          <Plus className="h-4 w-4" /> {t("settings.buckets.addBucket")}
        </button>
      </div>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const mut = useMutation({
    mutationFn: async () =>
      (await api.post("/auth/change-password", { current_password: current, new_password: pw })).data,
    onSuccess: () => {
      toast.success(t("settings.password.success"));
      setCurrent("");
      setPw("");
      setConfirmPw("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("settings.password.failed")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current) {
      toast.error(t("settings.password.errors.emptyCurrent"));
      return;
    }
    if (pw.length < 6) {
      toast.error(t("settings.password.errors.tooShort"));
      return;
    }
    if (pw !== confirmPw) {
      toast.error(t("settings.password.errors.mismatch"));
      return;
    }
    mut.mutate();
  }

  return (
    <form className="card p-6" onSubmit={onSubmit}>
      <h3 className="font-semibold mb-4">{t("settings.password.title")}</h3>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">{t("settings.password.current")}</label>
          <input
            type="password"
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">{t("settings.password.new")}</label>
          <input
            type="password"
            className="input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="label">{t("settings.password.confirm")}</label>
          <input
            type="password"
            className="input"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button pending={mut.isPending}>
          <Save className="h-4 w-4" /> {t("settings.password.submit")}
        </Button>
      </div>
    </form>
  );
}
