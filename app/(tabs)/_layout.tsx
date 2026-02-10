import { Tabs } from 'expo-router';
import React from 'react';

// ✅ On garde uniquement les icônes et les couleurs
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Couleur de l'onglet actif (Bleu par défaut)
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        // 🗑️ SUPPRIMÉ : HapticTab (le bouton personnalisé)
        // 🗑️ SUPPRIMÉ : tabBarBackground (le fond transparent/flou)
        // 🗑️ SUPPRIMÉ : tabBarStyle (le style flottant sur iOS)
      }}>
      
      {/* 1. DASHBOARD TAB (Accueil) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />

      {/* 2. MISSIONS TAB (Liste des missions) */}
      <Tabs.Screen
        name="missions" 
        options={{
          title: 'Missions',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet.clipboard.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}