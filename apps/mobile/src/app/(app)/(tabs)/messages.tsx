import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Placeholder } from '@/components/Placeholder';
import { Screen } from '@/components/Screen';

export default function MessagesScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('messages.title')}</AppText>
      <Placeholder badge={t('common.phase', { n: 5 })} text={t('common.comingSoon')} />
    </Screen>
  );
}
