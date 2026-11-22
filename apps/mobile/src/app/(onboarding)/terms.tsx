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
        <Consent testID="accept-terms" checked={terms} onChange={setTerms} label={t('terms.acceptTerms')} href="/legal/terms" />
        <Consent testID="accept-privacy" checked={privacy} onChange={setPrivacy} label={t('terms.acceptPrivacy')} href="/legal/privacy" />
        <Consent testID="accept-rules" checked={rules} onChange={setRules} label={t('terms.acceptRules')} href="/legal/guidelines" />
      </View>
    </Screen>
  );
}

/**
 * Une case de consentement + le lien vers le document, SÉPARÉS : toucher le
 * texte coche la case, seul « Lire → » ouvre le document.
 */
function Consent({
  testID,
  checked,
  onChange,
  label,
  href,
}: {
  testID: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  href: '/legal/terms' | '/legal/privacy' | '/legal/guidelines';
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Checkbox testID={testID} checked={checked} onChange={onChange}>
        <AppText>{label}</AppText>
      </Checkbox>
      <Link href={href} style={{ marginLeft: 24 + spacing.md }}>
        <AppText color={colors.primary}>{t('terms.read')} →</AppText>
      </Link>
    </View>
  );
}
