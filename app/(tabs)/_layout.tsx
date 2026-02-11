import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

// ✅ Keep your existing Icon component
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {

  return (
    <Tabs
      screenOptions={{
        // 1. THEME COLORS (Dark Blue & Gold)
        tabBarActiveTintColor: '#D4AF37', // Gold for active tab
        tabBarInactiveTintColor: '#64748b', // Grey for inactive tabs
        
        // 2. BAR STYLE (Dark Background)
        tabBarStyle: {
          backgroundColor: '#0f172a', // Dark Blue Background
          borderTopWidth: 1,
          borderTopColor: '#1e293b', // Subtle top border
          height: Platform.OS === 'ios' ? 85 : 60, // Taller on iPhone X+
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 8,
        },
        
        // 3. HEADER (Hidden)
        headerShown: false,
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