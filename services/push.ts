import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { isExpoPushToken, message, routes } from '../lib/shared';
import { call } from './call';
import { currentLocale } from './i18n-core';

/**
 * Push notifications (P1-15): a new assignment reaches the artisan's phone even when the app is closed.
 *
 * It needs a real phone and a development build (Expo Go does not carry remote push any more), a project id
 * (`eas init` writes it into app.json, or EXPO_PUBLIC_EAS_PROJECT_ID), and, on Android, the Firebase key of the
 * project uploaded to Expo. When one of them is missing, nothing here throws: the app works without push.
 */
const TOKEN_KEY = 'push_token';

/** The channel the Expo push service writes to when the server names none. Android 8+ shows nothing without it. */
const CHANNEL = 'default';

/** How a push that arrives while the app is open is shown: as a banner, with the sound. */
export function configurePushDisplay() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  return fromConfig || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined;
}

/**
 * The notification channel of the app on Android, named in the language of the app now (the name the phone's settings show). Made at the
 * registration and again when the technician changes the language, so that the settings do not keep the old name. It does not ask for
 * the permission. Nothing is done on another system, on a simulator, or when the phone refuses.
 */
export async function nameChannel(): Promise<void> {
  try {
    if (!Device.isDevice || Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: message(currentLocale(), 'app.push.channelName'),
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4AF37',
    });
  } catch {
    // The channel keeps its name: nothing else depends on it.
  }
}

/**
 * Asks for the permission, gets the token of this phone and gives it to the server, for the signed-in artisan.
 * Gives back the token, or null when this phone cannot have push (a simulator, a refusal, no project id).
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    await nameChannel();

    let permission = await Notifications.getPermissionsAsync();

    if (permission.status !== 'granted') {
      permission = await Notifications.requestPermissionsAsync();
    }

    if (permission.status !== 'granted') return null;

    const id = projectId();

    if (!id) {
      console.warn('Push: no project id (run "eas init", or set EXPO_PUBLIC_EAS_PROJECT_ID).');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });

    if (!isExpoPushToken(token)) return null;

    await call(
      routes.notifications.registerPushToken({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? Device.modelName ?? undefined,
      }),
    );

    await SecureStore.setItemAsync(TOKEN_KEY, token);

    return token;
  } catch (error) {
    console.warn('Push: this phone could not be registered.', error instanceof Error ? error.message : error);

    return null;
  }
}

/**
 * Stops the pushes to this phone for the signed-in artisan, and clears the ones already shown in the notification
 * tray (they are about this artisan's missions). Called before the session is wiped (the call needs it). Best
 * effort: a phone without network can still sign out. When the server could not be told, the token stays on the
 * server until the next person to sign in on this phone takes it over (the server moves a token to whoever
 * registers it); this phone forgets it either way.
 */
export async function unregisterPush(signal?: AbortSignal): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // the tray is a courtesy
  }

  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    if (!token) return;

    try {
      await call(routes.notifications.removePushToken(token), { signal });
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    console.warn('Push: this phone could not be unregistered.', error instanceof Error ? error.message : error);
  }
}
