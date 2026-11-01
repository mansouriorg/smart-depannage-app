import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ IMPORT API SERVICE
import { LanguageLink } from '@/components/LanguageLink';
import { BRAND_NAME } from '../../constants/brand';
import api, { saveTokens } from '../../services/api';
import { useI18n } from '../../services/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const { t, onSignedIn } = useI18n();
  
  // Aucun identifiant pré-rempli : un mot de passe par défaut dans l'écran
  // est un mot de passe par défaut en production.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Basic Validation
    if (!email || !password) {
      Alert.alert(t('common.states.error'), t('app.login.missingFields'));
      return;
    }

    setLoading(true);

    try {
      // 🚀 2. REAL API CALL TO BACKEND
      const response = await api.post('/auth/login', { 
        email: email.toLowerCase().trim(), 
        password: password 
      });

      // 3. The backend returns { accessToken, refreshToken, user }.
      // (The response is never logged: it contains the tokens.)
      const { accessToken, refreshToken } = response.data;

      if (!accessToken) {
        throw new Error('Missing token in the server response.');
      }

      // 4. Save both tokens securely on the device
      await saveTokens({ accessToken, refreshToken });

      // The account has a language on the server: the app keeps the one chosen on this phone, or takes the account's (P3-04).
      void onSignedIn(response.data.user?.locale);
      
      // 5. Navigate to the Main App (Tabs)
      router.replace('/(tabs)'); 

    } catch (error: any) {
      // Display a friendly error message (never log credentials or tokens)
      const message =
        error.response?.status === 429
          ? t('app.login.tooManyAttempts')
          : error.response?.data?.message || t('app.login.failed');
      const displayMessage = Array.isArray(message) ? message[0] : message;
      
      Alert.alert(t('app.login.failedTitle'), displayMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        
        {/* LOGO AREA */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🛠️</Text>
          <Text style={styles.logoText}>{BRAND_NAME}</Text>
          <Text style={styles.subtitle}>{t('app.login.subtitle')}</Text>
        </View>

        {/* FORM INPUTS */}
        <View style={styles.form}>
          
          {/* EMAIL INPUT */}
          <Text style={styles.label}>{t('app.login.email')}</Text>
          <TextInput 
            style={[styles.input, styles.ltrInput]} 
            placeholder={t('app.login.emailPlaceholder')} 
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* PASSWORD INPUT */}
          <Text style={styles.label}>{t('app.login.password')}</Text>
          <TextInput 
            style={styles.input} 
            placeholder={t('app.login.passwordPlaceholder')} 
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry // 🔒 Hides the password
          />

          {/* LOGIN BUTTON */}
          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginButtonText}>{t('app.login.submit')}</Text>
            )}
          </TouchableOpacity>

          {/* LANGUAGE (P3-04): before signing in there is no profile screen to choose it on */}
          <LanguageLink />
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a', // Dark Blue
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b', // Slate Gray
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F8FAFC', // Very light gray
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0f172a',
  },
  // An address is written left to right, whatever the language of the screen.
  ltrInput: {
    writingDirection: 'ltr',
  },
  loginButton: {
    backgroundColor: '#007AFF', // iOS Blue
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#93C5FD', // Light blue when disabled
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
