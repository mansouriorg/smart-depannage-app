import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

// 1. Corrected Import Paths (PascalCase to match your filenames)
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Uses your theme colors for the active tab (Blue/White)
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        
        // Uses the custom button component you created for haptic feedback
        tabBarButton: HapticTab,
        
        // Removes the default background to allow blur effects on iOS
        tabBarBackground: undefined,
        
        tabBarStyle: Platform.select({
          ios: {
            // Absolute position makes the tab bar float over content on iOS
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      
      {/* 1. DASHBOARD TAB */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />

      {/* 2. MISSIONS TAB */}
      <Tabs.Screen
        name="missions" 
        options={{
          title: 'Missions',
          // 'list.bullet.clipboard.fill' maps to the clipboard icon in your IconSymbol file
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet.clipboard.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}