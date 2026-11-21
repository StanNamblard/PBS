import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { signOut } from '@/features/auth/api';

export default function SuspendedScreen() {
  const { t } = useTranslation();
  return (
    <Screen footer={<Button variant="ghost" label={t('common.signOut')} onPress={() => void signOut()} />}>
      <AppText variant="title">{t('suspended.title')}</AppText>
      <AppText muted>{t('suspended.body')}</AppText>
    </Screen>
  );
}
