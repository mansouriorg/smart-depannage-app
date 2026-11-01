import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar'; // ✅ Controls the top system bar color
import { useEffect, useRef } from 'react';
import { I18nManager } from 'react-native';

import { I18nProvider, useI18n } from '../services/i18n';
import { configurePushDisplay } from '../services/push';
import { missionHrefFromPush, pushGate } from '../services/push-routing';

// How a push is shown while the app is open must be set before the first one arrives (P1-15).
configurePushDisplay();

// Arabic is read right to left (P3-04): the system may mirror its own bars (tab bar, headers). It does so at the next launch after a
// language change (the provider stores the direction with `forceRTL`); the screens follow the language at once through the provider's root view.
// The direction is the app's own choice and nothing else: with `allowRTL(true)`, a phone set to Arabic would draw the system bars from
// right to left whatever language the technician chose in the app (and a technician who chose French could not turn it off).
I18nManager.allowRTL(false);

/**
 * A tap on a push opens the mission it is about (P1-15). The hook gives the tap that started the app as well as
 * the ones that come after. The gate keeps a tap until the signed-in screens are on show, so that the welcome
 * screen (or the login) does not undo it.
 */
function usePushTaps() {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!last || handled.current === last) return;

    handled.current = last;

    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    pushGate.tapped(missionHrefFromPush(last.notification.request.content.data));
  }, [last]);
}

function AppShell() {
  usePushTaps();

  const { t } = useI18n();

  return (
    <>
      {/* 1. Set Status Bar to Light (White text) for Dark Background */}
      <StatusBar style="light" backgroundColor="#0f172a" />

      <Stack
        screenOptions={{
          // ✅ 2. GLOBAL DARK THEME SETTINGS
          headerStyle: {
            backgroundColor: '#0f172a', // Dark Blue Header Background
          },
          headerTintColor: '#D4AF37', // Gold Back Button & Text
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#FFFFFF', // White Title Text
          },
          // This ensures the background is dark even while navigating/loading
          contentStyle: {
            backgroundColor: '#0f172a', 
          },
        }}
      >
        {/* 3. Hide header for Splash Screen */}
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />

        {/* 4. Hide header for Auth (Login) */}
        <Stack.Screen 
          name="(auth)" 
          options={{ headerShown: false }} 
        />

        {/* 5. Hide header for Tabs (The tab bar handles navigation) */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* Change password (P1-11): a screen with the dark header and a back button */}
        <Stack.Screen 
          name="change-password" 
          options={{ title: t('app.nav.changePassword') }} 
        />

        {/* 6. Modals (Will inherit the Dark Theme above) */}
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal', title: t('app.nav.details') }} 
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
