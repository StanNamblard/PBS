import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { cancelAccountDeletion, getAccountStatus } from '@/features/account/api';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';

/** Suppression demandée : on peut encore annuler pendant 30 jours. */
export default function DeletionPendingScreen() {
  const { t, i18n } = useTranslation();
  const { refreshOnboarding } = useAuth();
  const { data } = useQuery({ queryKey: ['accountStatus'], queryFn: getAccountStatus });
  const [loading, setLoading] = useState(false);
  const date = data?.deletion_scheduled_for
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(data.deletion_scheduled_for))
    : '…';

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('account.cancelDeletion')}
            loading={loading}
            onPress={async () => {
              setLoading(true);
              await cancelAccountDeletion();
              await refreshOnboarding();
              setLoading(false);
            }}
          />
          <Button variant="ghost" label={t('common.signOut')} onPress={() => void signOut()} />
        </>
      }
    >
      <AppText variant="title">{t('account.deletionTitle')}</AppText>
      <AppText muted>{t('account.deletionBody', { date })}</AppText>
    </Screen>
  );
}
