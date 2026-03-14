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
    fr: "Français",
    it: "Italiano",
    pt: "Português",
    nl: "Nederlands",
    pl: "Polski",
    ru: "Русский",
    tr: "Türkçe",
  }

  const languageBadge = languageBadgeByCode[lang] || lang.toUpperCase()
  return {
    ...englishPack,
    "Language": {
      fr: "Langue",
      it: "Lingua",
      pt: "Idioma",
      nl: "Taal",
      pl: "Język",
      ru: "Язык",
      tr: "Dil",
    }[lang] || englishPack["Language"],
    "Apply language": {
      fr: "Appliquer la langue",
      it: "Applica lingua",
      pt: "Aplicar idioma",
      nl: "Taal toepassen",
      pl: "Zastosuj język",
      ru: "Применить язык",
      tr: "Dili uygula",
    }[lang] || englishPack["Apply language"],
    "Translating...": {
      fr: "Traduction en cours...",
      it: "Traduzione in corso...",
      pt: "Traduzindo...",
      nl: "Vertalen...",
      pl: "Tłumaczenie...",
      ru: "Перевод...",
      tr: "Çevriliyor...",
    }[lang] || englishPack["Translating..."],
    "Built-in for EN/DE/ES, Google-powered language packs for the rest of the top 50 languages.": {
      fr: "Les 10 langues principales sont intégrées en dur. Les autres langues passent par l'API.",
      it: "Le 10 lingue principali sono codificate localmente. Le altre lingue passano tramite API.",
      pt: "Os 10 principais idiomas são codificados localmente. Os demais idiomas usam API.",
      nl: "De 10 belangrijkste talen zijn hardcoded. Overige talen lopen via de API.",
      pl: "10 głównych języków jest zakodowanych lokalnie. Pozostałe języki działają przez API.",
      ru: "10 основных языков зашиты локально. Остальные языки работают через API.",
      tr: "İlk 10 dil yerel olarak sabit kodlanmıştır. Diğer diller API üzerinden çalışır.",
    }[lang] || englishPack["Built-in for EN/DE/ES, Google-powered language packs for the rest of the top 50 languages."],
    "Sign in": {
      fr: "Se connecter",
      it: "Accedi",
      pt: "Entrar",
      nl: "Inloggen",
      pl: "Zaloguj się",
      ru: "Войти",
      tr: "Giriş yap",
    }[lang] || englishPack["Sign in"],
    "Learn": {
      fr: "Apprendre",
      it: "Impara",
      pt: "Aprender",
      nl: "Leren",
      pl: "Nauka",
      ru: "Обучение",
      tr: "Öğren",
    }[lang] || englishPack["Learn"],
    "Start free": {
      fr: "Commencer gratuitement",
      it: "Inizia gratis",
      pt: "Começar grátis",
      nl: "Start gratis",
      pl: "Zacznij za darmo",
      ru: "Начать бесплатно",
      tr: "Ücretsiz başla",
    }[lang] || englishPack["Start free"],
    "Start free - no card": {
      fr: "Commencer gratuitement - sans carte",
      it: "Inizia gratis - senza carta",
      pt: "Comece grátis - sem cartão",
      nl: "Start gratis - geen kaart nodig",
      pl: "Zacznij za darmo - bez karty",
      ru: "Начать бесплатно - без карты",
      tr: "Ücretsiz başla - kart gerekmez",
    }[lang] || englishPack["Start free - no card"],
    "Features": {
      fr: "Fonctionnalites",
      it: "Funzionalità",
      pt: "Recursos",
      nl: "Functies",
      pl: "Funkcje",
      ru: "Функции",
      tr: "Özellikler",
    }[lang] || englishPack["Features"],
    "Pricing": {
      fr: "Tarifs",
      it: "Prezzi",
      pt: "Preços",
      nl: "Prijzen",
      pl: "Cennik",
      ru: "Цены",
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
      ru: "Тёмная",
      tr: "Koyu",
    }[lang] || englishPack["Dark"],
    "Light": {
      fr: "Clair",
      it: "Chiaro",
      pt: "Claro",
      nl: "Licht",
      pl: "Jasny",
      ru: "Светлая",
      tr: "Açık",
    }[lang] || englishPack["Light"],
    "Early access": {
      fr: "Accès anticipé",
      it: "Accesso anticipato",
      pt: "Acesso antecipado",
      nl: "Vroege toegang",
      pl: "Wczesny dostęp",
      ru: "Ранний доступ",
      tr: "Erken erişim",
    }[lang] || englishPack["Early access"],
    "all languages": {
      fr: "toutes les langues",
      it: "tutte le lingue",
      pt: "todos os idiomas",
      nl: "alle talen",
      pl: "wszystkie języki",
      ru: "все языки",
      tr: "tüm diller",
    }[lang] || englishPack["all languages"],
    "Menu": {
      fr: "Menu",
      it: "Menu",
      pt: "Menu",
      nl: "Menu",
      pl: "Menu",
      ru: "Меню",
      tr: "Menü",
    }[lang] || englishPack["Menu"],
    "Compare": {
      fr: "Comparer",
      it: "Confronta",
      pt: "Comparar",
      nl: "Vergelijken",
      pl: "Porównanie",
      ru: "Сравнить",
      tr: "Karşılaştır",
    }[lang] || englishPack["Compare"],
    "Get started": {
      fr: "Commencer",
      it: "Inizia",
      pt: "Começar",
      nl: "Aan de slag",
      pl: "Rozpocznij",
      ru: "Начать",
      tr: "Başla",
    }[lang] || englishPack["Get started"],
    "Import. Edit. Export.": {
      fr: "Importer. Modifier. Exporter.",
      it: "Importa. Modifica. Esporta.",
      pt: "Importe. Edite. Exporte.",
      nl: "Importeer. Bewerk. Exporteer.",
      pl: "Importuj. Edytuj. Eksportuj.",
      ru: "Импорт. Редактирование. Экспорт.",
      tr: "İçe aktar. Düzenle. Dışa aktar.",
    }[lang] || englishPack["Import. Edit. Export."],
    "The website": {
      fr: "Le site web",
      it: "Il sito web",
      pt: "O site",
      nl: "De website",
      pl: "Strona internetowa",
      ru: "Веб-сайт",
      tr: "Web sitesi",
    }[lang] || englishPack["The website"],
    "operations": {
      fr: "opérations",
      it: "operazioni",
      pt: "operações",
      nl: "operaties",
      pl: "operacje",
      ru: "операции",
      tr: "operasyonları",
    }[lang] || englishPack["operations"],
    "system.": {
      fr: "système.",
      it: "sistema.",
      pt: "sistema.",
      nl: "systeem.",
      pl: "system.",
      ru: "система.",
      tr: "sistemi.",
    }[lang] || englishPack["system."],
    "Import any existing website. Edit it visually with AI.": {
      fr: "Importez n'importe quel site existant. Modifiez-le visuellement avec l'IA.",
      it: "Importa qualsiasi sito esistente. Modificalo visivamente con l'IA.",
      pt: "Importe qualquer site existente. Edite-o visualmente com IA.",
      nl: "Importeer elke bestaande website. Bewerk deze visueel met AI.",
      pl: "Importuj dowolną istniejącą stronę. Edytuj ją wizualnie z pomocą AI.",
      ru: "Импортируйте любой существующий сайт. Редактируйте его визуально с ИИ.",
      tr: "Mevcut herhangi bir web sitesini içe aktarın. Yapay zekayla görsel olarak düzenleyin.",
    }[lang] || englishPack["Import any existing website. Edit it visually with AI."],
    "Launch in whatever format and market your client needs.": {
      fr: "Publiez dans le format et le marché dont votre client a besoin.",
      it: "Pubblica nel formato e nel mercato richiesti dal cliente.",
      pt: "Publique no formato e no mercado que seu cliente precisa.",
      nl: "Publiceer in het formaat en de markt die je klant nodig heeft.",
      pl: "Publikuj w formacie i na rynku, których potrzebuje klient.",
      ru: "Запускайте в формате и на рынке, которые нужны вашему клиенту.",
      tr: "Müşterinizin ihtiyaç duyduğu formatta ve pazarda yayına alın.",
    }[lang] || englishPack["Launch in whatever format and market your client needs."],
    "How it works": {
      fr: "Comment ça marche",
      it: "Come funziona",
      pt: "Como funciona",
      nl: "Hoe het werkt",
      pl: "Jak to działa",
      ru: "Как это работает",
      tr: "Nasıl çalışır",
    }[lang] || englishPack["How it works"],
    "Four steps. One system.": {
      fr: "Quatre étapes. Un seul système.",
      it: "Quattro passaggi. Un unico sistema.",
      pt: "Quatro etapas. Um único sistema.",
      nl: "Vier stappen. Eén systeem.",
      pl: "Cztery kroki. Jeden system.",
      ru: "Четыре шага. Одна система.",
      tr: "Dört adım. Tek sistem.",
    }[lang] || englishPack["Four steps. One system."],
    "Import": {
      fr: "Importer",
      it: "Importa",
      pt: "Importar",
      nl: "Importeren",
      pl: "Import",
      ru: "Импорт",
      tr: "İçe Aktar",
    }[lang] || englishPack["Import"],
    "Understand": {
      fr: "Comprendre",
      it: "Comprendi",
      pt: "Entender",
      nl: "Begrijpen",
      pl: "Zrozumienie",
      ru: "Понимание",
      tr: "Anla",
    }[lang] || englishPack["Understand"],
    "Edit + AI": {
      fr: "Modifier + IA",
      it: "Modifica + IA",
      pt: "Editar + IA",
      nl: "Bewerken + AI",
      pl: "Edycja + AI",
      ru: "Редактирование + ИИ",
      tr: "Düzenleme + YZ",
    }[lang] || englishPack["Edit + AI"],
    "Export + Deploy": {
      fr: "Exporter + Déployer",
      it: "Esporta + Distribuisci",
      pt: "Exportar + Publicar",
      nl: "Exporteren + Deployen",
      pl: "Eksport + Wdrożenie",
      ru: "Экспорт + Развертывание",
      tr: "Dışa Aktar + Yayınla",
    }[lang] || englishPack["Export + Deploy"],
    "Everything agencies need.": {
      fr: "Tout ce dont les agences ont besoin.",
      it: "Tutto ciò che serve alle agenzie.",
      pt: "Tudo o que as agências precisam.",
      nl: "Alles wat bureaus nodig hebben.",
      pl: "Wszystko, czego potrzebują agencje.",
      ru: "Всё, что нужно агентствам.",
      tr: "Ajansların ihtiyaç duyduğu her şey.",
    }[lang] || englishPack["Everything agencies need."],
    "Nothing they don't.": {
      fr: "Rien de superflu.",
      it: "Niente di superfluo.",
      pt: "Nada do que não precisam.",
      nl: "Niets overbodigs.",
      pl: "Nic zbędnego.",
      ru: "Ничего лишнего.",
      tr: "Gereksiz hiçbir şey yok.",
    }[lang] || englishPack["Nothing they don't."],
    "Coverage matrix": {
      fr: "Matrice de couverture",
      it: "Matrice di copertura",
      pt: "Matriz de cobertura",
      nl: "Dekkingsmatrix",
      pl: "Macierz pokrycia",
      ru: "Матрица покрытия",
      tr: "Kapsama matrisi",
    }[lang] || englishPack["Coverage matrix"],
    "Capability category": {
      fr: "Catégorie de capacité",
      it: "Categoria funzionale",
      pt: "Categoria de capacidade",
      nl: "Capaciteitscategorie",
      pl: "Kategoria możliwości",
      ru: "Категория возможностей",
      tr: "Yetenek kategorisi",
    }[lang] || englishPack["Capability category"],
    "Coverage intensity": {
      fr: "Intensité de couverture",
      it: "Intensità della copertura",
      pt: "Intensidade de cobertura",
      nl: "Dekkingsintensiteit",
      pl: "Intensywność pokrycia",
      ru: "Интенсивность покрытия",
      tr: "Kapsama yoğunluğu",
    }[lang] || englishPack["Coverage intensity"],
    "High": {
      fr: "Élevée",
      it: "Alta",
      pt: "Alta",
      nl: "Hoog",
      pl: "Wysoka",
      ru: "Высокая",
      tr: "Yüksek",
    }[lang] || englishPack["High"],
    "Medium": {
      fr: "Moyenne",
      it: "Media",
      pt: "Média",
      nl: "Gemiddeld",
      pl: "Średnia",
      ru: "Средняя",
      tr: "Orta",
    }[lang] || englishPack["Medium"],
    "Low": {
      fr: "Faible",
      it: "Bassa",
      pt: "Baixa",
      nl: "Laag",
      pl: "Niska",
      ru: "Низкая",
      tr: "Düşük",
    }[lang] || englishPack["Low"],
    "Comparison": {
      fr: "Comparaison",
      it: "Confronto",
      pt: "Comparação",
      nl: "Vergelijking",
      pl: "Porównanie",
      ru: "Сравнение",
      tr: "Karşılaştırma",
    }[lang] || englishPack["Comparison"],
    "60s demo": {
      fr: "Démo 60 s",
      it: "Demo di 60 s",
      pt: "Demo de 60 s",
      nl: "Demo van 60 s",
      pl: "Demo 60 s",
      ru: "Демо 60 с",
      tr: "60 sn demo",
    }[lang] || englishPack["60s demo"],
    "Guided walkthrough": {
      fr: "Visite guidée",
      it: "Panoramica guidata",
      pt: "Tour guiado",
      nl: "Rondleiding",
      pl: "Przewodnik krok po kroku",
      ru: "Пошаговый обзор",
      tr: "Rehberli tur",
    }[lang] || englishPack["Guided walkthrough"],
    "ROI Calculator": {
      fr: "Calculateur de ROI",
      it: "Calcolatore ROI",
      pt: "Calculadora de ROI",
      nl: "ROI-calculator",
      pl: "Kalkulator ROI",
      ru: "Калькулятор ROI",
      tr: "ROI Hesaplayıcı",
    }[lang] || englishPack["ROI Calculator"],
    "Calculate your margin recovery.": {
      fr: "Calculez votre récupération de marge.",
      it: "Calcola il recupero del tuo margine.",
      pt: "Calcule a recuperação da sua margem.",
      nl: "Bereken je margeherstel.",
      pl: "Oblicz odzysk marży.",
      ru: "Рассчитайте восстановление маржи.",
      tr: "Marj geri kazanımınızı hesaplayın.",
    }[lang] || englishPack["Calculate your margin recovery."],
    "Drag the sliders to match your workload.": {
      fr: "Ajustez les curseurs selon votre charge de travail.",
      it: "Regola i cursori in base al tuo carico di lavoro.",
      pt: "Ajuste os controles ao seu volume de trabalho.",
      nl: "Pas de schuifregelaars aan op je workload.",
      pl: "Dopasuj suwaki do swojego obciążenia pracą.",
      ru: "Настройте ползунки под вашу нагрузку.",
      tr: "İş yükünüze göre kaydırıcıları ayarlayın.",
    }[lang] || englishPack["Drag the sliders to match your workload."],
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
