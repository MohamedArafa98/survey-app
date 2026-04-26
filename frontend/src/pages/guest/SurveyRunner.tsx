import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useGuestForm } from "./guestStore";
import { Button } from "../../components/Button";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

type Question = {
  id: number;
  text: string;
  allow_comment: boolean;
  order_index: number;
  category_id: number | null;
};
type Category = { id: number; name: string; order_index: number };
type Survey = {
  id: number;
  title: string;
  description: string;
  questions: Question[];
  categories: Category[];
};

export default function SurveyRunner() {
  const { id } = useParams<{ id: string }>();
  const sid = Number(id);
  const navigate = useNavigate();
  const { data: form, clear } = useGuestForm();
  const { t } = useTranslation();

  const { data: survey, isLoading } = useQuery({
    queryKey: ["public-survey", sid],
    queryFn: async () => (await api.get<Survey>(`/public/surveys/${sid}`)).data,
  });

  const [answers, setAnswers] = useState<Record<number, { score: number; comment: string }>>({});
  const [missingIds, setMissingIds] = useState<Set<number>>(new Set());
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const submit = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/public/surveys/${sid}/responses`, {
          occupation: form!.occupation,
          gender: form!.gender,
          age: form!.age,
          name: form!.name,
          answers: Object.entries(answers).map(([qid, a]) => ({
            question_id: Number(qid),
            score: a.score,
            comment: a.comment || null,
          })),
        })
      ).data,
    onSuccess: () => {
      clear();
      toast.success(t("guest.submit.success"));
      navigate("/guest", { replace: true });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || t("guest.submit.error"));
      clear();
      navigate("/guest", { replace: true });
    },
  });

  if (!submit.isPending && !submit.isSuccess && !submit.isError && (!form || form.survey_id !== sid)) {
    return <Navigate to={`/guest/${sid}/info`} replace />;
  }
  if (isLoading || !survey) return <div className="p-6 text-slate-500">{t("common.loading")}</div>;

  const total = survey.questions.length;
  const answered = Object.keys(answers).length;

  const categories = survey.categories || [];
  const groups: { cat: Category | null; items: Question[] }[] = [
    ...categories.map((cat) => ({
      cat,
      items: survey.questions.filter((q) => q.category_id === cat.id),
    })),
    { cat: null, items: survey.questions.filter((q) => q.category_id == null) },
  ].filter((g) => g.items.length > 0);

  const indexById = new Map<number, number>();
  let displayIdx = 0;
  for (const g of groups) {
    for (const item of g.items) {
      displayIdx += 1;
      indexById.set(item.id, displayIdx);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to={`/guest/${sid}/info`} className="text-sm text-slate-500 hover:underline">
            ← {t("guest.runner.back")}
          </Link>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{survey.title}</h1>
        {survey.description && <p className="text-sm text-slate-600">{survey.description}</p>}

        <div className="mt-3 rounded-md bg-white border px-4 py-2 text-xs text-slate-600">
          {t("guest.runner.progress")}: <b>{answered}</b> / {total}
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const missing = survey.questions
              .filter((q) => answers[q.id]?.score == null)
              .map((q) => q.id);
            if (missing.length > 0) {
              setMissingIds(new Set(missing));
              toast.error(t("guest.runner.errors.incomplete"));
              questionRefs.current[missing[0]]?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
              return;
            }
            setMissingIds(new Set());
            submit.mutate();
          }}
        >
          {groups.map((g) => (
            <Fragment key={g.cat?.id ?? "uncategorized"}>
              {(g.cat || categories.length > 0) && (
                <div className="pt-2 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {g.cat ? g.cat.name : t("guest.runner.uncategorized")}
                </div>
              )}
              {g.items.map((q) => {
                const missing = missingIds.has(q.id);
                const i = (indexById.get(q.id) ?? 1) - 1;
                return (
            <div
              key={q.id}
              ref={(el) => {
                questionRefs.current[q.id] = el;
              }}
              className={`card p-5 ${missing ? "border-red-500 bg-red-50" : ""}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-slate-400 w-8">{i + 1}.</span>
                <div className="font-medium">{q.text}</div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((score) => {
                  const selected = answers[q.id]?.score === score;
                  return (
                    <button
                      type="button"
                      key={score}
                      className={`rounded-lg border px-2 py-3 text-center transition ${
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold"
                          : "border-slate-200 hover:border-brand-400"
                      }`}
                      onClick={() => {
                        setAnswers((a) => ({
                          ...a,
                          [q.id]: { score, comment: a[q.id]?.comment || "" },
                        }));
                        setMissingIds((prev) => {
                          if (!prev.has(q.id)) return prev;
                          const next = new Set(prev);
                          next.delete(q.id);
                          return next;
                        });
                      }}
                    >
                      <div className="text-lg">{score}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        {score === 1
                          ? t("guest.runner.scoreLabels.worst")
                          : score === 5
                            ? t("guest.runner.scoreLabels.best")
                            : ""}
                      </div>
                    </button>
                  );
                })}
              </div>

              {q.allow_comment && (
                <textarea
                  className="input mt-3 min-h-[60px]"
                  placeholder={t("guest.runner.commentPlaceholder")}
                  value={answers[q.id]?.comment || ""}
                  onChange={(e) =>
                    setAnswers((a) => ({
                      ...a,
                      [q.id]: { score: a[q.id]?.score || 0, comment: e.target.value },
                    }))
                  }
                />
              )}
            </div>
                );
              })}
            </Fragment>
          ))}

          <div className="flex justify-end">
            <Button pending={submit.isPending}>
              {t("guest.runner.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
