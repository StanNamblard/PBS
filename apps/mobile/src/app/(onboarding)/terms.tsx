import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/**
 * Consentement explicite (RGPD) : cases NON pré-cochées, une par document.
 * L'acceptation est enregistrée côté serveur (version + date) à la création du profil.
 */
export default function TermsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [rules, setRules] = useState(false);

  return (
    <Screen
      scroll
      footer={
        <Button
          testID="terms-continue"
          label={t('common.continue')}
          disabled={!(terms && privacy && rules)}
          onPress={() => router.push('/profile-setup')}
        />
      }
    >
      <AppText variant="title">{t('terms.title')}</AppText>
      <AppText muted>{t('terms.subtitle')}</AppText>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <Checkbox testID="accept-terms" checked={terms} onChange={setTerms}>
          <AppText>{t('terms.acceptTerms')}</AppText>
          <Link href="/legal/terms">
            <AppText color={colors.primary}>{t('terms.read')} →</AppText>
          </Link>
        </Checkbox>
        <Checkbox testID="accept-privacy" checked={privacy} onChange={setPrivacy}>
          <AppText>{t('terms.acceptPrivacy')}</AppText>
          <Link href="/legal/privacy">
            <AppText color={colors.primary}>{t('terms.read')} →</AppText>
          </Link>
        </Checkbox>
        <Checkbox testID="accept-rules" checked={rules} onChange={setRules}>
          <AppText>{t('terms.acceptRules')}</AppText>
          <Link href="/legal/guidelines">
            <AppText color={colors.primary}>{t('terms.read')} →</AppText>
          </Link>
        </Checkbox>
      </View>
    </Screen>
  );
}
