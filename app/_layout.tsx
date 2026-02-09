import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

// Make sure this path matches your actual file. 
// If your file is named 'useColorScheme.ts', remove the dashes.
import { useColorScheme } from '@/hooks/use-color-scheme';
export const unstable_settings = {
  // Ensure any deep link or reload starts at the auth flow first
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="(auth)">
        
        {/* 1. The Login Screen (Entry Point) */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        {/* 2. The Main App (Dashboard & Missions) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* 3. The Mission Details Page */}
        <Stack.Screen 
          name="mission/[id]" 
          options={{ 
            title: 'Mission Details',
            headerBackTitle: 'Back' 
          }} 
        />

        {/* 4. The Modal (Optional/Existing) */}
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}