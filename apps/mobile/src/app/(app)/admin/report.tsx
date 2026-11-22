import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { listReports, resolveReport, setUserStatus } from '@/features/admin/api';
import { MediaStrip } from '@/features/admin/MediaStrip';
import { confirm, notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

/** Détail d'un signalement et décision de l'admin. */
export default function AdminReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => listReports('open') });
  const report = data?.find((r) => r.report_id === id);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (action: 'dismiss' | 'remove_content' | 'suspend' | 'ban', label: string) => {
    if (!report) return;
    if (action !== 'dismiss') {
      const ok = await confirm({ title: label, message: `@${report.target_username}`, confirmText: label, cancelText: t('common.cancel'), destructive: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await resolveReport(report.report_id, action, note.trim() || null);
      await qc.invalidateQueries({ queryKey: ['admin'] });
      notify(t('admin.done'));
      router.back();
    } catch (e) {
      notify(t(serverErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={t('admin.reports')} />
      {!report ? (
        <Screen>
          <AppText muted>{t('admin.noReports')}</AppText>
        </Screen>
      ) : (
        <Screen
          scroll
          footer={
            <>
              <Button variant="secondary" label={t('admin.dismiss')} disabled={busy} onPress={() => void act('dismiss', t('admin.dismiss'))} />
              <Button variant="secondary" label={t('admin.removeContent')} disabled={busy} onPress={() => void act('remove_content', t('admin.removeContent'))} />
              <Button variant="danger" label={t('admin.suspend')} disabled={busy} onPress={() => void act('suspend', t('admin.suspend'))} />
              <Button variant="danger" label={t('admin.ban')} disabled={busy} onPress={() => void act('ban', t('admin.ban'))} />
            </>
          }
        >
          <AppText variant="title">@{report.target_username}</AppText>
          <AppText variant="bodyStrong">{t(`report.${report.reason}`)}</AppText>
          <AppText muted>
            {t('admin.context', { context: report.context })} · {t('admin.reportedBy', { username: report.reporter_username ?? '?' })}
          </AppText>
          <AppText muted>{t('admin.openReports', { n: report.target_open_reports })}</AppText>
          <AppText muted>{t('admin.statusLabel', { status: report.target_status ?? '?' })}</AppText>
          {report.details ? <AppText>« {report.details} »</AppText> : null}
          <MediaStrip media={report.media} size={200} />
          {report.target_status && report.target_status !== 'active' && report.target_id ? (
            <Button
              variant="ghost"
              label={t('admin.reactivate')}
              onPress={async () => {
                await setUserStatus(report.target_id!, 'active', null);
                await qc.invalidateQueries({ queryKey: ['admin'] });
                notify(t('admin.done'));
              }}
            />
          ) : null}
          <TextField label={t('admin.note')} value={note} onChangeText={setNote} multiline maxLength={500} />
        </Screen>
      )}
    </SafeAreaView>
  );
}
