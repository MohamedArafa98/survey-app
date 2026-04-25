import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";

type Question = { id: number; text: string; order_index: number };
type Survey = {
  id: number;
  title: string;
  period_label: string;
  questions: Question[];
};
type Answer = {
  id: number;
  question_id: number;
  score: number;
  comment: string | null;
};
type ResponseRow = {
  id: number;
  survey_id: number;
  submitted_at: string;
  occupation: string;
  gender: string;
  age: number;
  name: string | null;
  answers: Answer[];
};

export default function SurveyResponses() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const sid = Number(id);

  const { data: survey } = useQuery({
    queryKey: ["survey", sid],
    queryFn: async () => (await api.get<Survey>(`/surveys/${sid}`)).data,
  });
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["survey", sid, "responses", 10],
    queryFn: async () =>
      (await api.get<ResponseRow[]>(`/surveys/${sid}/responses?limit=10`)).data,
  });

  if (!survey || isLoading) {
    return <div className="text-slate-500">{t("common.loading")}</div>;
  }

  const questionById = new Map(survey.questions.map((q) => [q.id, q]));
  const orderedQuestions = [...survey.questions].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/surveys" className="text-sm text-slate-500 hover:underline">
          ← {t("surveys.responses.backToSurveys")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("surveys.responses.title")}</h1>
        <p className="text-sm text-slate-500">
          {t("surveys.responses.subtitle", { title: survey.title })}
        </p>
      </div>

      {responses.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">{t("surveys.responses.empty")}</div>
      ) : (
        <div className="space-y-4">
          {responses.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="grid gap-2 md:grid-cols-5 text-sm">
                <Cell label={t("surveys.responses.columns.submitted")}>
                  {new Date(r.submitted_at).toLocaleString()}
                </Cell>
                <Cell label={t("surveys.responses.columns.name")}>
                  {r.name || <span className="text-slate-400">{t("surveys.responses.anonymous")}</span>}
                </Cell>
                <Cell label={t("surveys.responses.columns.occupation")}>{r.occupation}</Cell>
                <Cell label={t("surveys.responses.columns.gender")}>{r.gender}</Cell>
                <Cell label={t("surveys.responses.columns.age")}>{r.age}</Cell>
              </div>

              <div className="mt-4 border-t pt-3">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  {t("surveys.responses.columns.answers")}
                </div>
                <ul className="space-y-2">
                  {orderedQuestions.map((q) => {
                    const a = r.answers.find((x) => x.question_id === q.id);
                    return (
                      <li key={q.id} className="flex flex-col gap-1 rounded-md bg-slate-50 px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="text-sm text-slate-800">{q.text}</div>
                          <ScorePill score={a?.score} />
                        </div>
                        {a?.comment && (
                          <div className="text-xs text-slate-600 italic">“{a.comment}”</div>
                        )}
                      </li>
                    );
                  })}
                  {r.answers
                    .filter((a) => !questionById.has(a.question_id))
                    .map((a) => (
                      <li key={a.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="italic">#{a.question_id}</div>
                          <ScorePill score={a.score} />
                        </div>
                        {a.comment && <div className="text-xs italic">“{a.comment}”</div>}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number | undefined }) {
  if (score === undefined) {
    return <span className="badge bg-slate-100 text-slate-500">—</span>;
  }
  const tone =
    score >= 4
      ? "bg-emerald-100 text-emerald-700"
      : score === 3
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return <span className={`badge ${tone}`}>{score} / 5</span>;
}
