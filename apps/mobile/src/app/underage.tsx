import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { clearDeviceUnderageForTesting, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';

export default function UnderageScreen() {
  const { t } = useTranslation();
  const { session, refreshOnboarding } = useAuth();
  return (
    <Screen
      footer={
        <>
          {session ? <Button variant="ghost" label={t('common.signOut')} onPress={() => void signOut()} /> : null}
          {/* Visible uniquement en développement, jamais dans l'app publiée */}
          {__DEV__ ? (
            <Button
              variant="ghost"
              label="[DEV] Réinitialiser le verrou de cet appareil"
              onPress={async () => {
                await signOut();
                await clearDeviceUnderageForTesting();
                await refreshOnboarding();
              }}
            />
          ) : null}
        </>
      }
    >
      <AppText variant="hero">{t('underage.title')}</AppText>
      <AppText muted>{t('underage.body')}</AppText>
    </Screen>
  );
}
