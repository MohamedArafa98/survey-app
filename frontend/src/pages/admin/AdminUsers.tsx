import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useState } from "react";
import { useAuthStore } from "../../store/auth";
import { UserPlus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";

type Admin = {
  id: number;
  username: string;
  role: "owner" | "admin";
  is_active: boolean;
  created_at: string;
};

export default function AdminUsers() {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { data: admins = [] } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => (await api.get<Admin[]>("/admins")).data,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [resetting, setResetting] = useState<Admin | null>(null);

  const patch = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Admin> }) =>
      (await api.patch(`/admins/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success(t("admins.toasts.updated"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("admins.toasts.updateFailed")),
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/admins/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success(t("admins.toasts.deactivated"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || t("admins.toasts.deactivateFailed")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("admins.title")}</h1>
          <p className="text-sm text-slate-500">{t("admins.subtitle")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4" /> {t("admins.newAdmin")}
        </button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-start">
              <th>{t("admins.columns.username")}</th>
              <th>{t("admins.columns.role")}</th>
              <th>{t("admins.columns.status")}</th>
              <th>{t("admins.columns.created")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {admins.map((a) => {
              const canChangeRole = me?.role === "owner" && a.role !== "owner";
              const canDeactivate = me?.role === "owner" && a.role !== "owner" && a.id !== me?.id;
              const canReset = me?.role === "owner" || a.id === me?.id;
              return (
                <tr key={a.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="font-medium">{a.username}</td>
                  <td>
                    {canChangeRole ? (
                      <select
                        className="input py-1 !w-28"
                        value={a.role}
                        onChange={(e) => patch.mutate({ id: a.id, data: { role: e.target.value as any } })}
                      >
                        <option value="admin">admin</option>
                        <option value="owner">owner</option>
                      </select>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-700">{a.role}</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        a.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {a.is_active ? t("admins.status.active") : t("admins.status.inactive")}
                    </span>
                  </td>
                  <td>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="text-end space-x-1">
                    {canReset && (
                      <button className="btn btn-ghost" onClick={() => setResetting(a)}>
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}
                    {canDeactivate && (
                      <button
                        className="btn btn-ghost text-red-600"
                        onClick={() => {
                          if (confirm(t("admins.deactivateConfirm", { name: a.username })))
                            del.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateAdminModal onClose={() => setShowCreate(false)} />}
      {resetting && <ResetPasswordModal admin={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function CreateAdminModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => (await api.post("/admins", { username, password, role })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success(t("admins.create.success"));
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || t("admins.create.failed");
      setErr(msg);
      toast.error(msg);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 3) {
      toast.error(t("admins.create.errors.usernameTooShort"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("admins.create.errors.passwordTooShort"));
      return;
    }
    if (password !== confirmPw) {
      toast.error(t("admins.create.errors.passwordMismatch"));
      return;
    }
    save.mutate();
  }

  return (
    <Modal title={t("admins.create.title")} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Field label={t("admins.create.username")}>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label={t("admins.create.password")}>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </Field>
        <Field label={t("admins.create.confirmPassword")}>
          <input
            type="password"
            className="input"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
          />
        </Field>
        {me?.role === "owner" && (
          <Field label={t("admins.create.role")}>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
          </Field>
        )}
        {err && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <Button pending={save.isPending}>{t("common.create")}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const { t } = useTranslation();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      (await api.post(`/admins/${admin.id}/reset-password`, { new_password: pw })).data,
    onSuccess: () => {
      toast.success(t("admins.reset.success"));
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || t("admins.reset.failed");
      setErr(msg);
      toast.error(msg);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error(t("admins.reset.errors.passwordTooShort"));
      return;
    }
    if (pw !== confirmPw) {
      toast.error(t("admins.reset.errors.passwordMismatch"));
      return;
    }
    save.mutate();
  }

  return (
    <Modal title={t("admins.reset.title", { name: admin.username })} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Field label={t("admins.reset.newPassword")}>
          <input
            type="password"
            className="input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            minLength={6}
            required
          />
        </Field>
        <Field label={t("admins.reset.confirmPassword")}>
          <input
            type="password"
            className="input"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
          />
        </Field>
        {err && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <Button pending={save.isPending}>{t("admins.reset.submit")}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
