import { useState, useCallback, useEffect } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Locale } from '@/types';
import { getTranslations, TranslationKey } from '@/constants/i18n';

const LOCALE_KEY = 'tabbakheen_locale';

export const [LocaleProvider, useLocale] = createContextHook(() => {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'ar') {
        setLocaleState(stored);
      }
      setIsReady(true);
    }).catch(() => {
      setIsReady(true);
    });
  }, []);

  const isRTL = locale === 'ar';
  const translations = getTranslations(locale);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[key] || key;
    },
    [translations],
  );

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    await AsyncStorage.setItem(LOCALE_KEY, newLocale);
    const shouldBeRTL = newLocale === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    setLocale(newLocale);
  }, [locale, setLocale]);

  return {
    locale,
    isRTL,
    isReady,
    t,
    setLocale,
    toggleLocale,
  };
});
