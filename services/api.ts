import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ✅ 1. READ URL FROM .ENV
// This allows you to change the IP in one place (.env) without touching the code.
const API_URL = process.env.EXPO_PUBLIC_API_URL;
console.log("🛠️ Tentative de connexion API sur :", API_URL); 

// Safety check: Log an error if the variable is missing
if (!API_URL) {
  console.error("❌ ERREUR CRITIQUE: La variable EXPO_PUBLIC_API_URL est manquante. Vérifiez votre fichier .env");
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// ✅ 2. INTERCEPTOR: Add Token to every request automatically
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('user_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du token", error);
  }
  return config;
});

// ✅ 3. HELPER: Save Token safely
export const saveToken = async (token: string) => {
  await SecureStore.setItemAsync('user_token', token);
};

// ✅ 4. HELPER: Get Token (ADDED THIS ONE)
// Used by Splash Screen to check login status
export const getToken = async () => {
  try {
    return await SecureStore.getItemAsync('user_token');
  } catch (error) {
    console.error("Erreur lecture token:", error);
    return null;
  }
};

// ✅ 5. HELPER: Remove Token (Logout)
export const removeToken = async () => {
  await SecureStore.deleteItemAsync('user_token');
};

export default api;