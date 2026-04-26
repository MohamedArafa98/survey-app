import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
};

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  variant = "danger",
  onConfirm,
  onCancel,
  pending,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-[60]">
      <div className="card p-6 w-full max-w-md shadow-xl animate-in zoom-in duration-200">
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <AlertTriangle className="h-6 w-6" />
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <p className="text-slate-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={pending}
          >
            {t("common.cancel")}
          </button>
          <Button
            variant={variant}
            onClick={onConfirm}
            pending={pending}
          >
            {confirmLabel || t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
