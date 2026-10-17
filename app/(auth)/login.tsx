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
import api, { saveTokens } from '../../services/api';

export default function LoginScreen() {
  const router = useRouter();
  
  // Aucun identifiant pré-rempli : un mot de passe par défaut dans l'écran
  // est un mot de passe par défaut en production.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Basic Validation
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez entrer votre email et votre mot de passe.');
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
        throw new Error("Token manquant dans la réponse du serveur.");
      }

      // 4. Save both tokens securely on the device
      await saveTokens({ accessToken, refreshToken });
      
      // 5. Navigate to the Main App (Tabs)
      router.replace('/(tabs)'); 

    } catch (error: any) {
      // Display a friendly error message (never log credentials or tokens)
      const message =
        error.response?.status === 429
          ? "Trop de tentatives. Réessayez dans quelques minutes."
          : error.response?.data?.message || "Échec de la connexion. Vérifiez vos identifiants ou votre réseau.";
      const displayMessage = Array.isArray(message) ? message[0] : message;
      
      Alert.alert("Erreur de connexion", displayMessage);
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
          <Text style={styles.logoText}>Smart Dépannage</Text>
          <Text style={styles.subtitle}>Espace Artisan</Text>
        </View>

        {/* FORM INPUTS */}
        <View style={styles.form}>
          
          {/* EMAIL INPUT */}
          <Text style={styles.label}>Adresse Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="technicien@smart-depannage.com" 
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* PASSWORD INPUT */}
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Votre mot de passe secret" 
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
              <Text style={styles.loginButtonText}>Se connecter</Text>
            )}
          </TouchableOpacity>
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
