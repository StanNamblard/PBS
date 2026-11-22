import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { reportUser, type ReportReason } from './api';

const REASONS: ReportReason[] = ['nudity', 'minor', 'harassment', 'hate', 'violence', 'spam', 'fake', 'other'];

interface Props {
  visible: boolean;
  onClose: () => void;
  targetId: string;
  username: string;
  context: 'selfie' | 'profile' | 'post' | 'story';
  contextId: string | null;
}

/** Signalement en 2 gestes : choisir un motif, envoyer. */
export function ReportSheet({ visible, onClose, targetId, username, context, contextId }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await reportUser(targetId, context, contextId, reason);
      onClose();
      setReason(null);
      notify(t('report.thanks'));
    } catch (e) {
      notify(t(serverErrorKey(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="title">{t('report.title', { username })}</AppText>
          <AppText muted>{t('report.subtitle')}</AppText>
          <View style={styles.list}>
            {REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[
                  styles.reason,
                  { borderColor: reason === r ? colors.danger : colors.border, backgroundColor: colors.surface },
                ]}
              >
                <AppText variant={reason === r ? 'bodyStrong' : 'body'}>{t(`report.${r}`)}</AppText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button variant="danger" label={t('match.report')} disabled={!reason} loading={sending} onPress={() => void send()} />
          <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  reason: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
