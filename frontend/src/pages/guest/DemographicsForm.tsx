import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useGuestForm } from "./guestStore";
import { Button } from "../../components/Button";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export default function DemographicsForm() {
  const { id } = useParams<{ id: string }>();
  const sid = Number(id);
  const navigate = useNavigate();
  const { set } = useGuestForm();
  const { t } = useTranslation();

  const { data: occupations = [] } = useQuery({
    queryKey: ["public-occupations"],
    queryFn: async () => (await api.get<string[]>("/public/occupations")).data,
  });
  const { data: allowOther } = useQuery({
    queryKey: ["public-allow-other-occupation"],
    queryFn: async () =>
      (await api.get<{ enabled: boolean }>("/public/allow-other-occupation")).data,
  });
  const otherEnabled = allowOther?.enabled ?? true;

  const [occupation, setOccupation] = useState("");
  const [otherOcc, setOtherOcc] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [age, setAge] = useState<number | "">("");
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const occFinal = occupation === "__other__" ? otherOcc.trim() : occupation.trim();
    if (!occFinal) return toast.error(t("guest.demographics.errors.occupation"));
    if (!gender) return toast.error(t("guest.demographics.errors.gender"));
    if (typeof age !== "number" || age < 10 || age > 110)
      return toast.error(t("guest.demographics.errors.age"));

    set({ survey_id: sid, occupation: occFinal, gender, age, name: name.trim() || undefined });
    navigate(`/guest/${sid}/answer`, { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/guest" className="text-sm text-slate-500 hover:underline">
            ← {t("common.back")}
          </Link>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{t("guest.demographics.title")}</h1>
        <p className="text-sm text-slate-600">{t("guest.demographics.subtitle")}</p>

        <form onSubmit={submit} className="card p-6 mt-6 space-y-4">
          <div>
            <label className="label">{t("guest.demographics.occupation")}</label>
            <select className="input" value={occupation} onChange={(e) => setOccupation(e.target.value)} required>
              <option value="">{t("guest.demographics.selectPlaceholder")}</option>
              {occupations.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              {otherEnabled && <option value="__other__">{t("guest.demographics.otherOption")}</option>}
            </select>
            {otherEnabled && occupation === "__other__" && (
              <input
                className="input mt-2"
                placeholder={t("guest.demographics.otherPlaceholder")}
                value={otherOcc}
                onChange={(e) => setOtherOcc(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="label">{t("guest.demographics.gender")}</label>
            <div className="flex gap-4">
              {(["male", "female"] as const).map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g)}
                  />
                  <span>{t(`guest.demographics.${g}`)}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t("guest.demographics.age")}</label>
            <input
              type="number"
              min={10}
              max={110}
              className="input"
              value={age}
              onChange={(e) => setAge(e.target.value ? +e.target.value : "")}
              required
            />
          </div>

          <div>
            <label className="label">
              {t("guest.demographics.name")}{" "}
              <span className="text-slate-400 text-xs">({t("common.optional")})</span>
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button>{t("guest.demographics.continue")}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
