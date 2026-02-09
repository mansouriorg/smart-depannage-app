import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* This points to app/(auth)/login.tsx */}
      <Stack.Screen name="login" />
    </Stack>
  );
}