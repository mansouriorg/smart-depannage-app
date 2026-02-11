import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar'; // ✅ Controls the top system bar color

export default function RootLayout() {
  return (
    <>
      {/* 1. Set Status Bar to Light (White text) for Dark Background */}
      <StatusBar style="light" backgroundColor="#0f172a" />

      <Stack
        screenOptions={{
          // ✅ 2. GLOBAL DARK THEME SETTINGS
          headerStyle: {
            backgroundColor: '#0f172a', // Dark Blue Header Background
          },
          headerTintColor: '#D4AF37', // Gold Back Button & Text
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#FFFFFF', // White Title Text
          },
          // This ensures the background is dark even while navigating/loading
          contentStyle: {
            backgroundColor: '#0f172a', 
          },
        }}
      >
        {/* 3. Hide header for Splash Screen */}
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />

        {/* 4. Hide header for Auth (Login) */}
        <Stack.Screen 
          name="(auth)" 
          options={{ headerShown: false }} 
        />

        {/* 5. Hide header for Tabs (The tab bar handles navigation) */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* 6. Modals (Will inherit the Dark Theme above) */}
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal', title: 'Détails' }} 
        />
      </Stack>
    </>
  );
}