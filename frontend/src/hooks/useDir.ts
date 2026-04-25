import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLang } from "../i18n";

export function useDir() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const lang = i18n.language || "en";
    const dir = isRtlLang(lang) ? "rtl" : "ltr";
    const root = document.documentElement;
    root.setAttribute("dir", dir);
    root.setAttribute("lang", lang);
  }, [i18n.language]);
}
