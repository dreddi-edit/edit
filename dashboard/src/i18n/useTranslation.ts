import { useEffect, useMemo, useRef, useState } from "react"
import { translations } from "./translations"
import { translateTexts } from "../utils/googleApis"
import { TOP_TRANSLATION_LANGUAGES } from "../utils/htmlTranslation"

export type Language = string

const HARD_CODED_TOP_10_LANGUAGES = new Set(["en", "de", "es", "fr", "it", "pt", "nl", "pl", "ru", "tr"])
const CACHE_PREFIX = "ui-language-pack:"
const RUNTIME_CACHE_PREFIX = "ui-runtime-pack-v3:"

function createHardcodedPack(lang: Language): Record<string, string> | null {
  const englishPack = translations.en as Record<string, string>
  if (lang === "en") return englishPack
  if (lang === "de") return translations.de as Record<string, string>
  if (lang === "es") return translations.es as Record<string, string>

  if (!HARD_CODED_TOP_10_LANGUAGES.has(lang)) return null

  const languageBadgeByCode: Record<string, string> = {
    fr: "Francais",
    it: "Italiano",
    pt: "Portugues",
    nl: "Nederlands",
    pl: "Polski",
    ru: "Russkiy",
    tr: "Turkce",
  }

  const languageBadge = languageBadgeByCode[lang] || lang.toUpperCase()
  return {
    ...englishPack,
    "Language": {
      fr: "Langue",
      it: "Lingua",
      pt: "Idioma",
      nl: "Taal",
      pl: "Jezyk",
      ru: "Yazyk",
      tr: "Dil",
    }[lang] || englishPack["Language"],
    "Apply language": {
      fr: "Appliquer la langue",
      it: "Applica lingua",
      pt: "Aplicar idioma",
      nl: "Taal toepassen",
      pl: "Zastosuj jezyk",
      ru: "Primenit yazyk",
      tr: "Dili uygula",
    }[lang] || englishPack["Apply language"],
    "Translating...": {
      fr: "Traduction en cours...",
      it: "Traduzione in corso...",
      pt: "Traduzindo...",
      nl: "Vertalen...",
      pl: "Tlumaczenie...",
      ru: "Perevod...",
      tr: "Cevriliyor...",
    }[lang] || englishPack["Translating..."],
    "Built-in for EN/DE/ES, Google-powered language packs for the rest of the top 50 languages.": {
      fr: "Top 10 en local. Les autres langues utilisent l'API.",
      it: "Top 10 in locale. Le altre lingue usano l'API.",
      pt: "Top 10 local. Os demais idiomas usam API.",
      nl: "Top 10 lokaal. Overige talen via API.",
      pl: "Top 10 lokalnie. Pozostale jezyki przez API.",
      ru: "Top 10 lokalno. Ostalnye yazyki cherez API.",
      tr: "Ilk 10 yerel. Diger diller API ile.",
    }[lang] || englishPack["Built-in for EN/DE/ES, Google-powered language packs for the rest of the top 50 languages."],
    "Sign in": {
      fr: "Se connecter",
      it: "Accedi",
      pt: "Entrar",
      nl: "Inloggen",
      pl: "Zaloguj sie",
      ru: "Voyti",
      tr: "Giris yap",
    }[lang] || englishPack["Sign in"],
    "Learn": {
      fr: "Apprendre",
      it: "Impara",
      pt: "Aprender",
      nl: "Leren",
      pl: "Nauka",
      ru: "Obuchenie",
      tr: "Ogren",
    }[lang] || englishPack["Learn"],
    "Start free": {
      fr: "Commencer gratuitement",
      it: "Inizia gratis",
      pt: "Comecar gratis",
      nl: "Start gratis",
      pl: "Zacznij za darmo",
      ru: "Nachat besplatno",
      tr: "Ucretsiz basla",
    }[lang] || englishPack["Start free"],
    "Start free - no card": {
      fr: "Commencer gratuitement - sans carte",
      it: "Inizia gratis - senza carta",
      pt: "Comece gratis - sem cartao",
      nl: "Start gratis - geen kaart",
      pl: "Zacznij za darmo - bez karty",
      ru: "Nachat besplatno - bez karty",
      tr: "Ucretsiz basla - kart yok",
    }[lang] || englishPack["Start free - no card"],
    "Features": {
      fr: "Fonctionnalites",
      it: "Funzionalita",
      pt: "Recursos",
      nl: "Functies",
      pl: "Funkcje",
      ru: "Funkcii",
      tr: "Ozellikler",
    }[lang] || englishPack["Features"],
    "Pricing": {
      fr: "Tarifs",
      it: "Prezzi",
      pt: "Precos",
      nl: "Prijzen",
      pl: "Cennik",
      ru: "Ceny",
      tr: "Fiyatlar",
    }[lang] || englishPack["Pricing"],
    "FAQ": {
      fr: "FAQ",
      it: "FAQ",
      pt: "FAQ",
      nl: "FAQ",
      pl: "FAQ",
      ru: "FAQ",
      tr: "SSS",
    }[lang] || englishPack["FAQ"],
    "Dark": {
      fr: "Sombre",
      it: "Scuro",
      pt: "Escuro",
      nl: "Donker",
      pl: "Ciemny",
      ru: "Temnyy",
      tr: "Koyu",
    }[lang] || englishPack["Dark"],
    "Light": {
      fr: "Clair",
      it: "Chiaro",
      pt: "Claro",
      nl: "Licht",
      pl: "Jasny",
      ru: "Svetlyy",
      tr: "Acik",
    }[lang] || englishPack["Light"],
    "Early access": {
      fr: "Acces anticipe",
      it: "Accesso anticipato",
      pt: "Acesso antecipado",
      nl: "Vroege toegang",
      pl: "Wczesny dostep",
      ru: "Ranniy dostup",
      tr: "Erken erisim",
    }[lang] || englishPack["Early access"],
    "all languages": {
      fr: "toutes les langues",
      it: "tutte le lingue",
      pt: "todos os idiomas",
      nl: "alle talen",
      pl: "wszystkie jezyki",
      ru: "vse yazyki",
      tr: "tum diller",
    }[lang] || englishPack["all languages"],
    "LANGUAGE": languageBadge,
  }
}

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
  if (lang === "en" || getCachedPack(lang)) return

  const hardcodedPack = createHardcodedPack(lang)
  if (hardcodedPack) {
    localStorage.setItem(`${CACHE_PREFIX}${lang}`, JSON.stringify(hardcodedPack))
    return
  }

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
  const [dynamicPack, setDynamicPack] = useState<Record<string, string>>(() => getCachedPack(lang) || {})
  const pendingRef = useRef<Set<string>>(new Set())
  const translatingRef = useRef(false)

  const t = (key: string): string => {
    const builtInPack = createHardcodedPack(lang)
    const englishPack = translations.en as Record<string, string>

    const resolved = builtInPack?.[key] ?? dynamicPack[key] ?? englishPack[key] ?? key

    // Auto-backfill missing keys for non-English languages so partial packs
    // (or new UI strings) are translated without manual dictionary updates.
    if (!HARD_CODED_TOP_10_LANGUAGES.has(lang) && lang !== "en" && resolved === key) {
      pendingRef.current.add(key)
    }

    return resolved
  }

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setDynamicPack(getCachedPack(lang) || {})
      pendingRef.current.clear()
    })
    return () => {
      cancelled = true
    }
  }, [lang])

  useEffect(() => {
    if (lang === "en" || HARD_CODED_TOP_10_LANGUAGES.has(lang)) return

    let cancelled = false
    const timer = window.setInterval(() => {
      if (cancelled || translatingRef.current) return
      const queued = Array.from(pendingRef.current)
      if (!queued.length) return

      const cached = getCachedPack(lang) || {}
      const missing = queued.filter((key) => !cached[key]).slice(0, 28)
      if (!missing.length) return

      missing.forEach((key) => pendingRef.current.delete(key))
      translatingRef.current = true

      void translateTexts(missing, lang)
        .then((translated) => {
          if (cancelled) return
          const nextEntries = missing.reduce<Record<string, string>>((acc, key, index) => {
            acc[key] = decodeEntities(translated[index]?.translatedText || key)
            return acc
          }, {})
          const merged = { ...cached, ...nextEntries }
          localStorage.setItem(`${CACHE_PREFIX}${lang}`, JSON.stringify(merged))
          setDynamicPack(merged)
        })
        .catch(() => {
          // Keep fallback English text if translation fails.
        })
        .finally(() => {
          translatingRef.current = false
        })
    }, 450)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [lang])

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
  const fallbackRef = useRef(fallback)
  const normalizedTexts = useMemo(
    () => Array.from(new Set(texts.map(text => String(text || "").trim()).filter(Boolean))),
    [texts],
  )
  const textSignature = normalizedTexts.join("\u0000")

  useEffect(() => {
    fallbackRef.current = fallback
  }, [fallback])

  useEffect(() => {
    setRuntimePack(getCachedRuntimePack(lang))
  }, [lang])

  useEffect(() => {
    if (HARD_CODED_TOP_10_LANGUAGES.has(lang) || !normalizedTexts.length) return
    const cached = getCachedRuntimePack(lang)
    const missing = normalizedTexts.filter(text => !cached[text] && fallbackRef.current(text) === text)
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
    if (HARD_CODED_TOP_10_LANGUAGES.has(lang)) return fallback(normalized)
    return runtimePack[normalized] || fallback(normalized)
  }
}
