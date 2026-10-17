import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

// ✅ 1. READ URL FROM .ENV
// This allows you to change the IP in one place (.env) without touching the code.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Safety check: Log an error if the variable is missing
if (!API_URL) {
  console.error("❌ ERREUR CRITIQUE: La variable EXPO_PUBLIC_API_URL est manquante. Vérifiez votre fichier .env");
}

const ACCESS_TOKEN_KEY = 'user_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Normal requests fail fast. Photo uploads are heavy and the artisan is often
// on a weak mobile connection: pass `timeout: UPLOAD_TIMEOUT_MS` on those (P0-15).
export const REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 90_000;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: REQUEST_TIMEOUT_MS,
});

// ==========================================================
// TOKENS (stored in the device's secure storage)
// ==========================================================

export const saveTokens = async (tokens: {
  accessToken: string;
  refreshToken?: string | null;
}) => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);

  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
};

export const getToken = async () => {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error("Erreur lecture token:", error);
    return null;
  }
};

export const getRefreshToken = async () => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Erreur lecture refresh token:", error);
    return null;
  }
};

/** Removes BOTH tokens (logout / expired session). */
export const removeToken = async () => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

// ==========================================================
// REQUEST: add the access token
// ==========================================================

api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du token", error);
  }
  return config;
});

// ==========================================================
// RESPONSE: 401 → silent refresh once, otherwise back to the login screen (P0-15)
//
// The access token lives 15 minutes. Without this, an artisan in the middle of
// a mission got errors on every call, and the only way out was the old splash
// screen "hack" that logged everybody out on each app start.
// ==========================================================

type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean };

class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
  }
}

// A refresh token can be used only once (the server rotates it), so parallel
// 401s must share ONE refresh call.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        throw new SessionExpiredError();
      }

      try {
        // Plain axios: this call must not go through the interceptors above.
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken },
          { timeout: REQUEST_TIMEOUT_MS },
        );

        await saveTokens(response.data);

        return response.data.accessToken as string;
      } catch (error) {
        const status = (error as AxiosError).response?.status;

        // The server said the refresh token is no good: the session is over.
        // Any other failure (no network, timeout) is temporary: keep the session.
        if (status === 400 || status === 401 || status === 403) {
          throw new SessionExpiredError();
        }

        throw error;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

let redirectingToLogin = false;

/** Clears the stored session and sends the user to the login screen. */
export async function endSession() {
  await removeToken();

  if (redirectingToLogin) return;

  redirectingToLogin = true;

  try {
    router.replace('/(auth)/login');
  } finally {
    // allow a later session to expire again
    setTimeout(() => {
      redirectingToLogin = false;
    }, 1000);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequest | undefined;
    const status = error.response?.status;

    const isAuthCall =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');

    if (status !== 401 || !original || original._retried || isAuthCall) {
      return Promise.reject(error);
    }

    original._retried = true;

    try {
      const newAccessToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${newAccessToken}`;

      return api(original);
    } catch (refreshError) {
      if (refreshError instanceof SessionExpiredError) {
        await endSession();
      }

      return Promise.reject(error);
    }
  },
);

export default api;
