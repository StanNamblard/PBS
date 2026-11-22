import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { guidelinesEn, privacyEn, termsEn } from '@/legal/en';
import { guidelinesFr, privacyFr, termsFr } from '@/legal/fr';
import { spacing } from '@/theme/tokens';

const DOCS = {
  terms: { fr: termsFr, en: termsEn },
  privacy: { fr: privacyFr, en: privacyEn },
  guidelines: { fr: guidelinesFr, en: guidelinesEn },
} as const;

/**
 * Documents légaux (brouillons à faire valider par un juriste).
 * Rendu simple : « # » titre, « ## » sous-titre, « - » puce.
 */
export default function LegalScreen() {
  const { t, i18n } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = (doc in DOCS ? doc : 'terms') as keyof typeof DOCS;
  const text = i18n.language === 'fr' ? DOCS[key].fr : DOCS[key].en;

  return (
    <Screen scroll footer={<Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
        {text.split('\n').map((line, i) => {
          if (!line.trim()) return null;
          if (line.startsWith('# ')) return <AppText key={i} variant="title">{line.slice(2)}</AppText>;
          if (line.startsWith('## ')) return <AppText key={i} variant="subtitle" style={{ marginTop: spacing.md }}>{line.slice(3)}</AppText>;
          if (line.startsWith('- ')) return <AppText key={i}>•  {line.slice(2)}</AppText>;
          return <AppText key={i} muted={i < 3}>{line}</AppText>;
        })}
      </View>
    </Screen>
  );
}
