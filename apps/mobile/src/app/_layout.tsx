import '@/lib/i18n';

import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DialogHost } from '@/components/DialogHost';
import { Screen } from '@/components/Screen';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { isConfigured } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RootNavigator />
              <DialogHost />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Aiguillage global : chaque groupe d'écrans n'est accessible que dans le bon
 * état (non connecté → onboarding → app). Les vrais contrôles de sécurité sont
 * côté serveur ; ceci ne fait que guider l'utilisateur.
 */
function RootNavigator() {
  const { colors, scheme } = useTheme();
  const { initializing, session, onboarding, deviceUnderage, onboardingError, refreshOnboarding } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (!initializing) void SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing) return null;

  if (onboardingError) {
    return (
      <Screen footer={<Button label={t('common.retry')} onPress={() => void refreshOnboarding()} />}>
        <AppText variant="title">{t('errors.network')}</AppText>
      </Screen>
    );
  }

  const signedIn = !!session;
  const underage = deviceUnderage || onboarding === 'underage';
  const inOnboarding = signedIn && !underage && (onboarding === 'age_required' || onboarding === 'profile_required');
  const suspended = signedIn && !underage && onboarding === 'suspended';
  const complete = signedIn && !underage && onboarding === 'complete';

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* Point d'entrée : redirige vers le bon groupe selon l'état */}
        <Stack.Screen name="index" />
        <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
        <Stack.Protected guard={!isConfigured}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={isConfigured}>
          <Stack.Protected guard={underage}>
            <Stack.Screen name="underage" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn && !underage}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={inOnboarding}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected guard={suspended}>
            <Stack.Screen name="suspended" />
          </Stack.Protected>
          <Stack.Protected guard={complete}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
    </>
  );
}
