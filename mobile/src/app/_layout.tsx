import * as React from 'react';
import { Alert, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { errorMessage, httpStatus } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useNotificationTaps } from '@/hooks/use-notification-taps';

SplashScreen.preventAutoHideAsync();

// Every successful change refreshes all data on screen; a failed change shows the server's reason
// (e.g. "Only the reviewer can …") unless the screen handles it.
const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        const status = httpStatus(error);
        return (status === undefined || status >= 500) && count < 2;
      },
    },
  },
  mutationCache: new MutationCache({
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      Alert.alert('Not done', errorMessage(error));
      void queryClient.invalidateQueries();
    },
  }),
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Navigation() {
  const scheme = useColorScheme();
  const { ready, signedIn, user } = useAuth();
  const mustChange = !!user?.must_change_password;
  const appOpen = signedIn && !mustChange;

  React.useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useNotificationTaps(appOpen);

  // Signed out: forget the previous user's data
  React.useEffect(() => {
    if (!signedIn) queryClient.clear();
  }, [signedIn]);

  if (!ready) return null;

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Protected guard={appOpen}>
          <Stack.Screen name="(app)" options={{ headerShown: false, title: "Back" }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="run/[id]" options={{ title: 'Period' }} />
          <Stack.Screen name="new-task" options={{ presentation: 'modal', title: 'New task' }} />
          <Stack.Screen name="change-password" options={{ presentation: 'modal', title: 'Change password' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && mustChange}>
          <Stack.Screen name="set-password" options={{ title: 'Set a new password', headerBackVisible: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
