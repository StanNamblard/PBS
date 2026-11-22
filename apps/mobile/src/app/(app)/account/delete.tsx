import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { requestAccountDeletion } from '@/features/account/api';
import { signOut } from '@/features/auth/api';
import { notify } from '@/lib/dialogs';
import { useTheme } from '@/theme/ThemeProvider';

/** Suppression du compte depuis l'app (exigence App Store / Google Play). */
export default function DeleteAccountScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const ok = typed.trim().toUpperCase() === t('account.deleteWord');

  const remove = async () => {
    setLoading(true);
    try {
      const when = await requestAccountDeletion();
      const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(when));
      notify(t('account.deleted', { date }));
      await signOut();
    } catch {
      notify(t('errors.generic'));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={t('account.deleteTitle')} />
      <Screen scroll footer={<Button variant="danger" label={t('account.deleteButton')} disabled={!ok} loading={loading} onPress={() => void remove()} />}>
        <AppText>{t('account.deleteIntro')}</AppText>
        <AppText muted>{t('account.deleteUndo')}</AppText>
        <Button variant="secondary" label={t('account.exportTitle')} onPress={() => router.push('/account/export')} />
        <AppText muted>{t('account.deleteExportHint')}</AppText>
        <TextField label={t('account.deleteType')} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
      </Screen>
    </SafeAreaView>
  );
}
