import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen
      footer={
        <>
          <Button testID="welcome-start" label={t('welcome.start')} onPress={() => router.push('/sign-in')} />
          <AppText variant="caption" muted center>
            {t('welcome.adultsOnly')}
          </AppText>
        </>
      }
    >
      <View style={styles.center}>
        <AppText variant="hero" color={colors.primary}>
          BPS
        </AppText>
        <AppText variant="title">{t('welcome.tagline')}</AppText>
        <AppText muted>{t('welcome.subtitle')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', gap: spacing.md } });
