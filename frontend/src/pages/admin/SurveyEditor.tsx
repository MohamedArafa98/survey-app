import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import { Fragment, useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import { ConfirmModal } from "../../components/ConfirmModal";

type Category = {
  id: number;
  survey_id: number;
  name: string;
  order_index: number;
};

type Question = {
  id: number;
  text: string;
  order_index: number;
  allow_comment: boolean;
  category_id: number | null;
};

type Survey = {
  id: number;
  title: string;
  description: string;
  period_label: string;
  state: string;
  response_count: number;
  questions: Question[];
  categories: Category[];
};

export default function SurveyEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const sid = Number(id);
  const qc = useQueryClient();

  const { data: survey } = useQuery({
    queryKey: ["survey", sid],
    queryFn: async () => (await api.get<Survey>(`/surveys/${sid}`)).data,
  });

  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadedSid, setLoadedSid] = useState<number | null>(null);

  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [questionToEdit, setQuestionToEdit] = useState<Question | null>(null);

  useEffect(() => {
    if (survey) {
      setTitle(survey.title || "");
      setPeriod(survey.period_label || "");
      setDescription(survey.description || "");
      setQuestions(survey.questions || []);
      setCategories(survey.categories || []);
    }
  }, [survey]);

  const saveMeta = useMutation({
    mutationFn: async () =>
      (await api.patch(`/surveys/${sid}`, { title: title.trim(), period_label: period, description })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("surveys.editor.toasts.detailsSaved"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.saveFailed")),
  });

  const createQ = useMutation({
    mutationFn: async (payload: { text: string; category_id: number | null }) =>
      (
        await api.post(`/surveys/${sid}/questions`, {
          text: payload.text,
          allow_comment: false,
          category_id: payload.category_id,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      toast.success(t("surveys.editor.toasts.questionAdded"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.addFailed")),
  });

  const patchQ = useMutation({
    mutationFn: async (q: Question) =>
      (
        await api.patch(`/surveys/${sid}/questions/${q.id}`, {
          text: q.text,
          allow_comment: q.allow_comment,
          order_index: q.order_index,
          category_id: q.category_id,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      toast.success(t("surveys.editor.toasts.questionUpdated"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.updateFailed")),
  });

  const delQ = useMutation({
    mutationFn: async (qid: number) => (await api.delete(`/surveys/${sid}/questions/${qid}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      toast.success(t("surveys.editor.toasts.questionDeleted"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.deleteFailed")),
  });

  const reorder = useMutation({
    mutationFn: async (order: number[]) =>
      (await api.post(`/surveys/${sid}/questions/reorder`, { order })).data,
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.reorderFailed")),
  });

  const createCategory = useMutation({
    mutationFn: async (name: string) =>
      (await api.post<Category>(`/surveys/${sid}/categories`, { name })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      toast.success(t("surveys.editor.toasts.categoryAdded"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.addFailed")),
  });

  const patchCategory = useMutation({
    mutationFn: async (c: Category) =>
      (await api.patch(`/surveys/${sid}/categories/${c.id}`, { name: c.name })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      toast.success(t("surveys.editor.toasts.categoryUpdated"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.updateFailed")),
  });

  const delCategory = useMutation({
    mutationFn: async (cid: number) =>
      (await api.delete(`/surveys/${sid}/categories/${cid}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey", sid] });
      toast.success(t("surveys.editor.toasts.categoryDeleted"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.deleteFailed")),
  });

  const reorderCategories = useMutation({
    mutationFn: async (order: number[]) =>
      (await api.post(`/surveys/${sid}/categories/reorder`, { order })).data,
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("surveys.editor.toasts.reorderFailed")),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeQ = questions.find((q) => q.id === active.id);
    const overQ = questions.find((q) => q.id === over.id);
    if (!activeQ || !overQ) return;
    if ((activeQ.category_id ?? null) !== (overQ.category_id ?? null)) {
      toast.error(t("surveys.editor.errors.crossCategoryDrag"));
      return;
    }
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const next = arrayMove(questions, oldIndex, newIndex);
    setQuestions(next);
    reorder.mutate(next.map((q) => q.id));
  }

  function handleEditQuestion(q: Question) {
    if (!q.text.trim()) {
      toast.error(t("surveys.editor.errors.emptyQuestion"));
      return;
    }
    if (survey && survey.response_count > 0) {
      setQuestionToEdit(q);
      return;
    }
    patchQ.mutate(q);
  }

  function onSaveMeta() {
    if (!title.trim()) {
      toast.error(t("surveys.editor.errors.emptyTitle"));
      return;
    }
    saveMeta.mutate();
  }

  function moveCategory(catId: number, delta: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === catId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= categories.length) return;
    const next = arrayMove(categories, idx, target);
    setCategories(next);
    reorderCategories.mutate(next.map((c) => c.id));
  }

  const [newQText, setNewQText] = useState("");
  const [newQCatId, setNewQCatId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState("");

  if (!survey) return <div className="text-slate-500">{t("common.loading")}</div>;

  const groups: { cat: Category | null; items: Question[] }[] = [
    ...categories.map((cat) => ({
      cat,
      items: questions.filter((q) => q.category_id === cat.id),
    })),
    { cat: null, items: questions.filter((q) => q.category_id == null) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/surveys" className="text-sm text-slate-500 hover:underline">
            ← {t("common.allSurveys")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("surveys.editor.title")}</h1>
          {survey.response_count > 0 && (
            <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("surveys.editor.warning", { count: survey.response_count })}
            </div>
          )}
        </div>
        <Link to={`/admin/surveys/${sid}/analytics`} className="btn btn-ghost">
          {t("surveys.editor.viewAnalytics")}
        </Link>
      </div>

      <div className="card p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">{t("surveys.editor.titleField")}</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("surveys.editor.periodField")}</label>
            <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t("surveys.editor.descriptionField")}</label>
          <textarea
            className="input min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button pending={saveMeta.isPending} onClick={onSaveMeta}>
            <Save className="h-4 w-4" /> {t("surveys.editor.saveDetails")}
          </Button>
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <div>
          <h3 className="font-semibold">{t("surveys.editor.categories")}</h3>
          <p className="text-sm text-slate-500">{t("surveys.editor.categoriesHint")}</p>
        </div>
        <div className="space-y-2">
          {categories.length === 0 && (
            <div className="text-sm text-slate-500">{t("surveys.editor.noCategories")}</div>
          )}
          {categories.map((c, i) => (
            <CategoryRow
              key={c.id}
              cat={c}
              isFirst={i === 0}
              isLast={i === categories.length - 1}
              onRename={(name) => patchCategory.mutate({ ...c, name })}
              onDelete={() => setCategoryToDelete(c)}
              onMoveUp={() => moveCategory(c.id, -1)}
              onMoveDown={() => moveCategory(c.id, 1)}
            />
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCatName.trim()) {
              toast.error(t("surveys.editor.errors.emptyCategory"));
              return;
            }
            createCategory.mutate(newCatName.trim());
            setNewCatName("");
          }}
        >
          <input
            className="input"
            placeholder={t("surveys.editor.addCategoryPlaceholder")}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <button className="btn btn-primary">
            <Plus className="h-4 w-4" /> {t("surveys.editor.addCategoryButton")}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold">{t("surveys.editor.questions")}</h3>
        <p className="text-sm text-slate-500">{t("surveys.editor.questionsHint")}</p>

        <div className="mt-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-5">
                {groups.map((g) => (
                  <Fragment key={g.cat?.id ?? "uncategorized"}>
                    <div className="flex items-baseline gap-2 border-b border-slate-200 pb-1">
                      <span className="font-medium text-slate-700">
                        {g.cat ? g.cat.name : t("surveys.editor.uncategorized")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t("surveys.editor.questionsCount", { count: g.items.length })}
                      </span>
                    </div>
                    {g.items.length === 0 ? (
                      <div className="text-sm text-slate-400 pl-2">
                        {t("surveys.editor.emptyGroup")}
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {g.items.map((q) => (
                          <QuestionRow
                            key={q.id}
                            q={q}
                            categories={categories}
                            onUpdate={handleEditQuestion}
                            onClone={() => {
                              createQ.mutate({ text: `${q.text} (${t("surveys.list.actions.clone")})`, category_id: q.category_id });
                            }}
                            onDelete={() => setQuestionToDelete(q)}
                          />
                        ))}
                      </ul>
                    )}
                  </Fragment>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newQText.trim()) {
              toast.error(t("surveys.editor.errors.emptyQuestion"));
              return;
            }
            createQ.mutate({ text: newQText.trim(), category_id: newQCatId });
            setNewQText("");
          }}
        >
          <input
            className="input flex-1 min-w-[200px]"
            placeholder={t("surveys.editor.addQuestionPlaceholder")}
            value={newQText}
            onChange={(e) => setNewQText(e.target.value)}
          />
          <select
            className="input max-w-[200px]"
            value={newQCatId ?? ""}
            onChange={(e) => setNewQCatId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("surveys.editor.uncategorized")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">
            <Plus className="h-4 w-4" /> {t("surveys.editor.addButton")}
          </button>
        </form>
      </div>

      {categoryToDelete && (
        <ConfirmModal
          title={t("surveys.editor.deleteCategoryConfirm")}
          message={categoryToDelete.name}
          onConfirm={() => {
            delCategory.mutate(categoryToDelete.id);
            setCategoryToDelete(null);
          }}
          onCancel={() => setCategoryToDelete(null)}
          pending={delCategory.isPending}
        />
      )}
      {questionToDelete && (
        <ConfirmModal
          title={t("surveys.editor.deleteQuestionConfirm")}
          message={questionToDelete.text}
          onConfirm={() => {
            delQ.mutate(questionToDelete.id);
            setQuestionToDelete(null);
          }}
          onCancel={() => setQuestionToDelete(null)}
          pending={delQ.isPending}
        />
      )}
      {questionToEdit && (
        <ConfirmModal
          title={t("surveys.editor.editQuestionConfirm")}
          message={questionToEdit.text}
          variant="primary"
          onConfirm={() => {
            patchQ.mutate(questionToEdit);
            setQuestionToEdit(null);
          }}
          onCancel={() => setQuestionToEdit(null)}
          pending={patchQ.isPending}
        />
      )}
    </div>
  );
}

function CategoryRow({
  cat,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  cat: Category;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cat.name);

  useEffect(() => {
    setDraft(cat.name);
  }, [cat.name]);

  function commit() {
    const next = draft.trim();
    if (!next) {
      setDraft(cat.name);
      setEditing(false);
      return;
    }
    if (next !== cat.name) onRename(next);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex flex-col">
        <button
          className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
          onClick={onMoveUp}
          disabled={isFirst}
          title={t("surveys.editor.moveUp")}
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
          onClick={onMoveDown}
          disabled={isLast}
          title={t("surveys.editor.moveDown")}
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      {editing ? (
        <>
          <input
            className="input flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(cat.name);
                setEditing(false);
              }
            }}
            autoFocus
          />
          <button className="btn btn-ghost" onClick={commit} title={t("common.save")}>
            <Save className="h-4 w-4" />
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setDraft(cat.name);
              setEditing(false);
            }}
            title={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium text-slate-700">{cat.name}</span>
          <button className="btn btn-ghost" onClick={() => setEditing(true)} title={t("common.edit")}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="btn btn-ghost text-red-600"
            onClick={(e) => {
              e.currentTarget.blur();
              e.stopPropagation();
              onDelete();
            }}
            title={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function QuestionRow({
  q,
  categories,
  onUpdate,
  onClone,
  onDelete,
}: {
  q: Question;
  categories: Category[];
  onUpdate: (q: Question) => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: q.id });
  const [text, setText] = useState(q.text);
  const [allowComment, setAllowComment] = useState(q.allow_comment);
  const [categoryId, setCategoryId] = useState<number | null>(q.category_id);

  useEffect(() => {
    setText(q.text);
    setAllowComment(q.allow_comment);
    setCategoryId(q.category_id);
  }, [q.id, q.text, q.allow_comment, q.category_id]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-slate-400">
        <GripVertical className="h-5 w-5" />
      </button>
      <input
        className="input flex-1 min-w-[200px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <select
        className="input max-w-[180px]"
        value={categoryId ?? ""}
        onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{t("surveys.editor.uncategorized")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={allowComment} onChange={(e) => setAllowComment(e.target.checked)} />
        {t("surveys.editor.commentsLabel")}
      </label>
      <div className="flex items-center gap-1">
        <button
          className="btn btn-ghost"
          title={t("surveys.editor.rowSave")}
          onClick={(e) => {
            e.currentTarget.blur();
            e.preventDefault();
            e.stopPropagation();
            onUpdate({ ...q, text, allow_comment: allowComment, category_id: categoryId });
          }}
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          className="btn btn-ghost"
          title={t("surveys.list.actions.clone")}
          onClick={(e) => {
            e.currentTarget.blur();
            e.preventDefault();
            e.stopPropagation();
            onClone();
          }}
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          className="btn btn-ghost text-red-600"
          title={t("common.delete")}
          onClick={(e) => {
            e.currentTarget.blur();
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
