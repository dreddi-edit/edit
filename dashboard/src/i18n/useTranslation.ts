import { useState } from "react"
import { translations } from "./translations"

export type Language = "en" | "de" | "es"

export function useTranslation() {
  const [lang, setLangState] = useState<Language>(
    () => (localStorage.getItem("ui-language") as Language) || "en"
  )

  const t = (key: string): string =>
    (translations[lang] as any)[key] ??
    (translations.en as any)[key] ??
    key

  const setLang = (l: Language) => {
    localStorage.setItem("ui-language", l)
    setLangState(l)
  }

  return { t, lang, setLang }
}
