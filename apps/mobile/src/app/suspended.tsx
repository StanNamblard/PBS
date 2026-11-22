import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { getAccountStatus } from '@/features/account/api';
import { signOut } from '@/features/auth/api';

/** Compte suspendu ou banni : motif de la décision + contact (obligation DSA). */
export default function SuspendedScreen() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ['accountStatus'], queryFn: getAccountStatus });
  return (
    <Screen footer={<Button variant="ghost" label={t('common.signOut')} onPress={() => void signOut()} />}>
      <AppText variant="title">{t('suspended.title')}</AppText>
      <AppText muted>{t('suspended.body')}</AppText>
      {data?.status_reason ? <AppText variant="bodyStrong">{t('account.suspendedReason', { reason: data.status_reason })}</AppText> : null}
      <AppText variant="caption" muted>
        {t('account.contact')}
      </AppText>
    </Screen>
  );
}
