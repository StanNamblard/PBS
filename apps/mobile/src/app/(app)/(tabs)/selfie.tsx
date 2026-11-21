import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Placeholder } from '@/components/Placeholder';
import { Screen } from '@/components/Screen';
import { SelfieButton } from '@/components/SelfieButton';
import { spacing } from '@/theme/tokens';

export default function SelfieScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('selfie.title')}</AppText>
      <AppText muted>{t('selfie.body')}</AppText>
      <View style={styles.center}>
        <SelfieButton size={140} accessibilityLabel={t('selfie.cta')} onPress={() => {}} />
      </View>
      <Placeholder badge={t('common.phase', { n: 3 })} text={t('common.comingSoon')} />
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', paddingVertical: spacing.xxl } });
