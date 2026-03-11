import { useState } from "react"
import { translations } from "./translations"

export type Language = "en" | "de" | "es"

export function useTranslation() {
  const [lang, setLangState] = useState<Language>(
    () => (localStorage.getItem("ui-language") as Language) || "en"
  )

  const t = (key: string): string =>
    (translations[lang] as Record<string, string>)[key] ??
    (translations.en as Record<string, string>)[key] ??
    key

  const setLang = (l: Language) => {
    localStorage.setItem("ui-language", l)
    setLangState(l)
    window.location.reload()
  }

  return { t, lang, setLang }
}
