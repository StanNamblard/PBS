import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { buildExport } from '@/features/account/api';
import { notify } from '@/lib/dialogs';
import { useTheme } from '@/theme/ThemeProvider';

/** Export RGPD : fichier JSON partagé via la feuille de partage du téléphone. */
export default function ExportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const content = await buildExport();
      const name = `bps-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      } else {
        const file = new File(Paths.cache, name);
        if (file.exists) file.delete();
        file.create();
        file.write(content);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('account.exportTitle') });
      }
      notify(t('account.exportReady'));
    } catch {
      notify(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={t('account.exportTitle')} />
      <Screen footer={<Button label={t('account.exportButton')} loading={loading} onPress={() => void run()} />}>
        <AppText>{t('account.exportBody')}</AppText>
      </Screen>
    </SafeAreaView>
  );
}
