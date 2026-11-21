import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

/** Affiché uniquement si le fichier .env n'est pas rempli. */
export default function SetupScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('setup.title')}</AppText>
      <AppText muted>{t('setup.body')}</AppText>
    </Screen>
  );
}
