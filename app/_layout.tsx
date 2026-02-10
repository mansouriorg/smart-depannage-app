import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* ✅ 1. Hide header for the Splash Screen (index.tsx) 
        This is the most important line to fix your issue.
      */}
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />

      {/* 2. Hide header for Auth flows (Login/Register) */}
      <Stack.Screen 
        name="(auth)" 
        options={{ headerShown: false }} 
      />

      {/* 3. Hide header for Tabs (The tabs layout handles its own headers) */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ headerShown: false }} 
      />
      
      {/* 4. Other global modals or screens */}
      <Stack.Screen 
        name="modal" 
        options={{ presentation: 'modal' }} 
      />
    </Stack>
  );
}