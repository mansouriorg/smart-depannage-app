import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

// ✅ IMPORT POUR VÉRIFIER ET SUPPRIMER LE TOKEN
import { getToken, removeToken } from '../services/api';

export default function Index() {
  const router = useRouter();
  
  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current; 
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // 1. Démarrer l'animation (Logo qui apparaît et grandit)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Vérification de la connexion (Logique intelligente)
    const checkAuthAndRedirect = async () => {
      try {
        // A. On attend 2.5 secondes pour laisser l'animation se jouer (Branding)
        await new Promise(resolve => setTimeout(resolve, 2500));

        // 🚨 THE HACK: On supprime le token de force
        await removeToken(); 
        console.log("🧹 Ghost token completely wiped!");

        // B. On vérifie si un token existe
        const token = await getToken();

        if (token) {
          // 🟢 Token trouvé -> On va direct au Dashboard
          console.log("Token trouvé, redirection vers Dashboard...");
          router.replace('/(tabs)');
        } else {
          // 🔴 Pas de token -> On va au Login
          console.log("Pas de token, redirection vers Login...");
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error("Erreur splash screen:", error);
        // En cas de doute, on renvoie vers le login
        router.replace('/(auth)/login');
      }
    };

    checkAuthAndRedirect();

  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.content, 
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}>
        
        {/* LOGO */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>SD</Text>
        </View>
        
        {/* TEXTE */}
        <Text style={styles.title}>Smart Dépannage</Text>
        <Text style={styles.subtitle}>Votre expert à portée de main</Text>
      </Animated.View>
      
      {/* FOOTER CHARGEMENT */}
      <View style={styles.footer}>
        <ActivityIndicator color="#D4AF37" style={{ marginRight: 10 }} />
        <Text style={styles.footerText}>Chargement...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Bleu nuit profond
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#D4AF37', // Or
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0f172a',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8', // Gris clair
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  }
});