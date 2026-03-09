import { useState, useEffect } from 'react'
import { translations } from './translations'
import type { Language, TranslationKey } from './translations'

export function useTranslation() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ui-language') as Language | null
    return saved || 'en'
  })

  useEffect(() => {
    localStorage.setItem('ui-language', language)
  }, [language])

  const t = (key: TranslationKey) => {
    return translations[language][key] || key
  }

  return { language, setLanguage, t }
}
