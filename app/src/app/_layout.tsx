import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { allowedGroup } from '@/features/auth/accountStatus';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAccountStatus } from '@/features/auth/useAccountStatus';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

/**
 * Garde de navigation (R-32) : seul le groupe permis par l'état du compte est accessible.
 * Quand l'état change (connexion, onboarding fini, déconnexion), expo-router revient sur
 * `index`, qui redirige vers le bon écran.
 */
function RootNavigator() {
  const { status } = useAccountStatus();
  const group = allowedGroup(status);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={group === 'auth'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={group === 'onboarding'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={group === 'app'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recette/[id]" />
        <Stack.Screen name="cook/[session]" />
        <Stack.Screen name="cook/photo" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
