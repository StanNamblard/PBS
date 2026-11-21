import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Placeholder } from '@/components/Placeholder';
import { Screen } from '@/components/Screen';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll>
      <AppText variant="title">{t('home.title')}</AppText>
      <Placeholder badge={t('common.phase', { n: 2 })} text={t('home.empty')} />
    </Screen>
  );
}
