import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { SelfieButton } from '@/components/SelfieButton';
import { useInboxCounts } from '@/features/messages/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Feather>['name'];

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Feather name={name} color={color as string} size={size - 2} />;

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: counts } = useInboxCounts();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, height: 88 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: icon('message-circle'),
          // Badge = non-lus de la boîte principale uniquement (les demandes restent silencieuses)
          tabBarBadge: counts?.primary_unread ? counts.primary_unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
      <Tabs.Screen
        name="selfie"
        options={{
          title: t('tabs.selfie'),
          tabBarLabel: () => null,
          // Le bouton selfie dépasse de la barre : c'est l'élément central de l'app.
          tabBarButton: () => (
            <View style={styles.selfieSlot}>
              <SelfieButton accessibilityLabel={t('selfie.cta')} onPress={() => router.navigate('/selfie')} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="qr" options={{ title: t('tabs.qr'), tabBarIcon: icon('maximize') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  selfieSlot: { flex: 1, alignItems: 'center', marginTop: -26 },
});
