import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { listenToNotificationTaps, scheduleDailyReminders } from '@/features/selfie/reminders';

import { useTheme } from '@/theme/ThemeProvider';

export default function AppLayout() {
  const { colors } = useTheme();

  // Reprogramme les rappels des 7 prochains jours à chaque ouverture de l'app
  useEffect(() => {
    void scheduleDailyReminders().catch(() => undefined);
    return listenToNotificationTaps((url) => router.push(url as never));
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="follow-requests" />
      <Stack.Screen name="user/[id]/index" />
      <Stack.Screen name="user/[id]/followers" />
      <Stack.Screen name="user/[id]/following" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="create/index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/post" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/story" options={{ presentation: 'modal' }} />
      <Stack.Screen name="selfie/camera" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#000' } }} />
      <Stack.Screen name="selfie/waiting/[id]" options={{ gestureEnabled: true }} />
      <Stack.Screen name="match/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="q/[token]" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="story/[userId]"
        options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#000' } }}
      />
    </Stack>
  );
}
