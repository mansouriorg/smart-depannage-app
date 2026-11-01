import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, type Href } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

// ✅ Keep your existing Icon component
import { IconSymbol } from '@/components/ui/icon-symbol';
import { registerForPush } from '../../services/push';
import { useI18n } from '../../services/i18n';
import { pushGate } from '../../services/push-routing';

export default function TabLayout() {
  const router = useRouter();
  const { t, syncLocale } = useI18n();

  // These screens are only on show for a signed-in artisan (P1-15): this is the moment to register the phone for
  // push, and to open the mission a tap on a push was waiting to open.
  useEffect(() => {
    const release = pushGate.ready((href) => router.push(href as Href));
    registerForPush();
    // The server writes the notifications in the language it was told: if the last telling did not get through, it is made again now.
    void syncLocale();

    return release;
  }, []);

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
          title: t('app.tabs.home'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />

      {/* 2. MISSIONS TAB (Liste des missions) */}
      <Tabs.Screen
        name="missions" 
        options={{
          title: t('app.tabs.missions'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet.clipboard.fill" color={color} />,
        }}
      />

      {/* 3. EARNINGS TAB (cash taken and the balance owed to the platform) */}
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('app.tabs.earnings'),
          tabBarIcon: ({ color }) => <Ionicons name="wallet" size={26} color={color} />,
        }}
      />

      {/* 4. PROFILE TAB (the real artisan) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('app.tabs.profile'),
          tabBarIcon: ({ color }) => <Ionicons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
