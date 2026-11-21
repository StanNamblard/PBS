import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

/**
 * Documents légaux. Le texte définitif (CGU, confidentialité, règles de la
 * communauté) sera rédigé en phase 6 et devra être relu par un juriste.
 */
export default function LegalScreen() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const title =
    doc === 'privacy' ? t('settings.privacy') : doc === 'guidelines' ? t('terms.acceptRules') : t('settings.terms');
  return (
    <Screen scroll footer={<Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />}>
      <AppText variant="title">{title}</AppText>
      <AppText muted>{t('common.phase', { n: 6 })}</AppText>
    </Screen>
  );
}
