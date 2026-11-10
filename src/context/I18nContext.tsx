import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { SUPPORTED_LANGUAGES, LanguageMeta, getLanguageMeta } from '../i18n/languages';
import { TRANSLATIONS, TranslationKey } from '../i18n/translations';

interface I18nContextType {
  language: string;
  setLanguage: (code: string) => void;
  currentLanguageMeta: LanguageMeta;
  supportedLanguages: LanguageMeta[];
  isRtl: boolean;
  t: (key: TranslationKey | string, fallback?: string) => string;
}

const STORAGE_KEY = 'pf_app_language';

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch {
      // fallback if localStorage not accessible
    }
    return 'en';
  });

  const currentLanguageMeta = useMemo(() => getLanguageMeta(language), [language]);
  const isRtl = currentLanguageMeta.dir === 'rtl';

  // Apply dir & lang attributes to document root whenever language changes
  useEffect(() => {
    try {
      document.documentElement.setAttribute('dir', currentLanguageMeta.dir);
      document.documentElement.setAttribute('lang', currentLanguageMeta.code);
    } catch {
      // safe fallback in non-browser/SSR environments
    }
  }, [currentLanguageMeta]);

  const setLanguage = useCallback((code: string) => {
    const meta = getLanguageMeta(code);
    setLanguageState(meta.code);
    try {
      localStorage.setItem(STORAGE_KEY, meta.code);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, fallback?: string): string => {
      const langDict = TRANSLATIONS[language];
      if (langDict && (langDict as Record<string, string>)[key]) {
        return (langDict as Record<string, string>)[key];
      }
      // Fallback to English dictionary
      const enDict = TRANSLATIONS['en'];
      if (enDict && (enDict as Record<string, string>)[key]) {
        return (enDict as Record<string, string>)[key];
      }
      return fallback !== undefined ? fallback : key;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      currentLanguageMeta,
      supportedLanguages: SUPPORTED_LANGUAGES,
      isRtl,
      t,
    }),
    [language, setLanguage, currentLanguageMeta, isRtl, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

