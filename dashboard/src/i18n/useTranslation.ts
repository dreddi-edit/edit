import { useEffect, useMemo, useState } from "react"
import { translations } from "./translations"
import { translateTexts } from "../utils/googleApis"
import { TOP_TRANSLATION_LANGUAGES } from "../utils/htmlTranslation"

export type Language = string

const BUILTIN_LANGUAGES = new Set(["en", "de", "es"])
const CACHE_PREFIX = "ui-language-pack:"
const RUNTIME_CACHE_PREFIX = "ui-runtime-pack:"

function getCachedPack(lang: Language): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${lang}`)
    return raw ? (JSON.parse(raw) as Record<string, string>) : null
  } catch {
    return null
  }
}

function decodeEntities(value: string): string {
  if (typeof document === "undefined") return value
  const textarea = document.createElement("textarea")
  textarea.innerHTML = value
  return textarea.value
}

function getCachedRuntimePack(lang: Language): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${RUNTIME_CACHE_PREFIX}${lang}`)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function setCachedRuntimePack(lang: Language, value: Record<string, string>) {
  try {
    localStorage.setItem(`${RUNTIME_CACHE_PREFIX}${lang}`, JSON.stringify(value))
  } catch {
    // Ignore storage failures (quota/private mode).
  }
}

async function ensureLanguagePack(lang: Language) {
  if (BUILTIN_LANGUAGES.has(lang) || getCachedPack(lang)) return

  const englishPack = translations.en as Record<string, string>
  const keys = Object.keys(englishPack)
  const sourceTexts = keys.map((key) => englishPack[key] ?? key)
  const translated = await translateTexts(sourceTexts, lang)
  const pack: Record<string, string> = {}

  keys.forEach((key, index) => {
    pack[key] = decodeEntities(translated[index]?.translatedText || englishPack[key] || key)
  })

  localStorage.setItem(`${CACHE_PREFIX}${lang}`, JSON.stringify(pack))
}

export const AVAILABLE_UI_LANGUAGES = TOP_TRANSLATION_LANGUAGES

export function useTranslation() {
  const [lang, setLangState] = useState<Language>(
    () => (localStorage.getItem("ui-language") as Language) || "en"
  )

  const t = (key: string): string => {
    const pack = BUILTIN_LANGUAGES.has(lang)
      ? (translations[lang as keyof typeof translations] as Record<string, string>)
      : getCachedPack(lang)

    return pack?.[key] ??
      (translations.en as Record<string, string>)[key] ??
      key
  }

  const setLang = async (l: Language) => {
    await ensureLanguagePack(l)
    localStorage.setItem("ui-language", l)
    setLangState(l)
    window.location.reload()
  }

  return { t, lang, setLang }
}

export function useRuntimeTranslations(
  lang: Language,
  texts: string[],
  fallback: (key: string) => string = (key) => key,
) {
  const [runtimePack, setRuntimePack] = useState<Record<string, string>>(() => getCachedRuntimePack(lang))
  const normalizedTexts = useMemo(
    () => Array.from(new Set(texts.map(text => String(text || "").trim()).filter(Boolean))),
    [texts],
  )
  const textSignature = normalizedTexts.join("\u0000")

  useEffect(() => {
    setRuntimePack(getCachedRuntimePack(lang))
  }, [lang])

  useEffect(() => {
    if (BUILTIN_LANGUAGES.has(lang) || !normalizedTexts.length) return
    const cached = getCachedRuntimePack(lang)
    const missing = normalizedTexts.filter(text => !cached[text])
    if (!missing.length) return

    let cancelled = false

    void translateTexts(missing, lang)
      .then(results => {
        if (cancelled) return
        const nextEntries = missing.reduce<Record<string, string>>((acc, text, index) => {
          acc[text] = decodeEntities(results[index]?.translatedText || text)
          return acc
        }, {})
        const merged = { ...cached, ...nextEntries }
        setCachedRuntimePack(lang, merged)
        setRuntimePack(merged)
      })
      .catch(() => {
        // Ignore runtime translation failures and keep fallback strings.
      })

    return () => {
      cancelled = true
    }
  }, [lang, normalizedTexts, textSignature])

  return (text: string) => {
    const normalized = String(text || "")
    if (!normalized) return normalized
    if (BUILTIN_LANGUAGES.has(lang)) return fallback(normalized)
    return runtimePack[normalized] || fallback(normalized)
  }
}
