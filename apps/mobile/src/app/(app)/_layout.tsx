import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

export default function AppLayout() {
  const { colors } = useTheme();
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
      <Stack.Screen
        name="story/[userId]"
        options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#000' } }}
      />
    </Stack>
  );
}
