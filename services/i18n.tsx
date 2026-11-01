import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, I18nManager, View } from 'react-native';

import { DEFAULT_LOCALE, isRtl as isRtlLocale, routes, translator, type Locale, type Translate } from '../lib/shared';
import { getToken } from './api';
import { nameChannel } from './push';
import { call } from './call';
import {
  LOCALE_PENDING_KEY,
  LOCALE_STORAGE_KEY,
  afterSignIn,
  createLocaleSync,
  currentLocale,
  deviceLanguageTag,
  directionChanged,
  directionStyle,
  nativeDirection,
  setCurrentLocale,
  startingLocale,
} from './i18n-core';

/**
 * The language of the app (P3-04): French or Arabic, with Arabic read right to left. The equivalent of `next-intl` on the website,
 * built with React Native, expo-secure-store and the shared catalogue (no new dependency).
 *
 *   const { t, locale, isRtl, setLocale } = useI18n();   t('app.login.submit')
 *
 * The language is the technician's: it is kept on the phone (SecureStore, `app_locale`) and on the server (`PATCH /users/me/locale`,
 * which decides the language of the notifications). Code outside React reads it with `currentLocale()`.
 */
export { currentLocale } from './i18n-core';

export interface I18nValue {
  locale: Locale;
  /** A message of the catalogue in the language of the app, with its values in. */
  t: Translate;
  /** Chooses a language: kept on the phone, told to the server when signed in, applied to the screens at once. */
  setLocale: (next: Locale) => Promise<void>;
  isRtl: boolean;
  /** To call once the sign-in has succeeded, with the `locale` the server answered: see `afterSignIn` for the rule. */
  onSignedIn: (serverLocale: unknown) => Promise<void>;
  /** To call when the signed-in screens come on show: tells the server the language again if an earlier telling did not get through. */
  syncLocale: () => Promise<void>;
}

// The native splash screen stays up until the stored language is read, so that no screen is drawn in the wrong language first.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const FALLBACK: I18nValue = {
  locale: 'fr',
  t: translator('fr'),
  setLocale: async () => {},
  isRtl: false,
  onSignedIn: async () => {},
  syncLocale: async () => {},
};

const I18nContext = createContext<I18nValue>(FALLBACK);

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/**
 * The signed-in account is told the language; a signed-out phone has no account to tell (the next sign-in does it). A telling that
 * does not get through (no network) leaves a note on the phone and is made again when the signed-in screens come on show.
 */
const localeSync = createLocaleSync({
  loadPending: async () => (await SecureStore.getItemAsync(LOCALE_PENDING_KEY)) === '1',
  savePending: async (pending) => {
    try {
      if (pending) await SecureStore.setItemAsync(LOCALE_PENDING_KEY, '1');
      else await SecureStore.deleteItemAsync(LOCALE_PENDING_KEY);
    } catch {
      // not kept: the telling is made again at the next sign-in
    }
  },
  signedIn: async () => {
    try {
      return Boolean(await getToken());
    } catch {
      return false;
    }
  },
  send: async (locale) => {
    await call(routes.users.setLocale(locale));
  },
  current: currentLocale,
});

/**
 * The direction that the system draws (tab bar, headers) is stored for the next launch; the screens follow at once through the root view.
 * It is stored every time, not only when it differs from the one now drawn: `I18nManager.isRTL` keeps the direction of this launch, so a
 * language chosen twice in a session (Arabic, then French) would otherwise leave the first choice stored for the next launch.
 */
function storeNativeDirection(locale: Locale): boolean {
  try {
    const { forceRtl, restart } = nativeDirection(locale, I18nManager.isRTL);

    I18nManager.forceRTL(forceRtl);

    return restart;
  } catch {
    // The system bars keep the direction they have; the screens follow the language through the root view all the same.
    return false;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);
  // Whether the technician (or the server, at sign-in) has decided: the phone's language is only a first guess.
  const chosen = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let stored: string | null = null;

      try {
        stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
      } catch {
        // unreadable: start from the language of the phone
      }

      if (cancelled) return;

      // The splash screen is held until a language is set: whatever goes wrong here, one is set (French).
      let start: { locale: Locale; chosen: boolean } = { locale: DEFAULT_LOCALE, chosen: false };

      try {
        start = startingLocale(stored, deviceLanguageTag());
      } catch {
        // French
      }

      chosen.current = start.chosen;
      setCurrentLocale(start.locale);
      storeNativeDirection(start.locale);
      setLocaleState(start.locale);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const ready = locale !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  /** Puts a language on the screens and keeps it on the phone. Says so when the system bars need a restart to follow. */
  const apply = useCallback(async (next: Locale) => {
    const before = currentLocale();

    chosen.current = true;
    setCurrentLocale(next);
    setLocaleState(next);
    void nameChannel(); // the name of the notification channel in the settings of the phone (Android)

    try {
      await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);
    } catch {
      // not kept: the app is in this language until it is closed
    }

    const restart = storeNativeDirection(next);

    if (restart && directionChanged(before, next)) {
      const say = translator(next);

      Alert.alert(say('app.language.restartTitle'), say('app.language.restartMessage'), [{ text: say('common.actions.ok') }]);
    }
  }, []);

  const setLocale = useCallback(
    async (next: Locale) => {
      if (next === currentLocale() && chosen.current) {
        await localeSync.retry(); // the same language chosen again is also a way to tell the server that did not get it
        return;
      }

      await apply(next);
      await localeSync.tell();
    },
    [apply],
  );

  const onSignedIn = useCallback(
    async (serverLocale: unknown) => {
      const { adopt, tell } = afterSignIn({ current: currentLocale(), chosen: chosen.current, server: serverLocale });

      if (adopt) await apply(adopt);
      else if (tell) await localeSync.tell();
    },
    [apply],
  );

  const syncLocale = useCallback(() => localeSync.retry(), []);

  const value = useMemo<I18nValue>(
    () => (locale === null ? FALLBACK : { locale, t: translator(locale), setLocale, isRtl: isRtlLocale(locale), onSignedIn, syncLocale }),
    [locale, setLocale, onSignedIn, syncLocale],
  );

  if (locale === null) return null;

  return (
    <I18nContext.Provider value={value}>
      <View style={[{ flex: 1 }, directionStyle(locale)]}>{children}</View>
    </I18nContext.Provider>
  );
}
