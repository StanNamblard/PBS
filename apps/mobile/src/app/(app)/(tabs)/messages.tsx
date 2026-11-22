import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { deleteConversation, type Folder, type InboxItem } from '@/features/messages/api';
import { confirm } from '@/lib/dialogs';
import { useInbox, useInboxCounts } from '@/features/messages/hooks';
import { publicUrl } from '@/lib/media';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Boîte de réception : « Principale » et « Demandes » (messages de personnes que je ne suis pas). */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [folder, setFolder] = useState<Folder>('primary');
  const inbox = useInbox(folder);
  const { data: counts } = useInboxCounts();
  const [selected, setSelected] = useState<InboxItem | null>(null);

  const remove = async (item: InboxItem) => {
    const ok = await confirm({ title: t('messages.deleteConfirm'), confirmText: t('messages.delete'), cancelText: t('common.cancel'), destructive: true });
    if (!ok) return;
    await deleteConversation(item.conversation_id);
    await qc.invalidateQueries({ queryKey: ['inbox'] });
  };

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    }, [qc]),
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="title">{t('messages.title')}</AppText>
        <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
          {(['primary', 'requests'] as Folder[]).map((f) => (
            <Pressable
              key={f}
              accessibilityRole="tab"
              accessibilityState={{ selected: folder === f }}
              onPress={() => setFolder(f)}
              style={[styles.segmentItem, folder === f && { backgroundColor: colors.surface }]}
            >
              <AppText variant="bodyStrong" muted={folder !== f}>
                {f === 'primary' ? t('messages.primary') : t('messages.requests')}
                {f === 'requests' && counts?.requests ? ` (${counts.requests})` : ''}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={inbox.data ?? []}
        keyExtractor={(i) => i.conversation_id}
        renderItem={({ item }) => <InboxRow item={item} onLongPress={() => setSelected(item)} />}
        refreshControl={<RefreshControl tintColor={colors.primary} refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} />}
        ListFooterComponent={
          inbox.data?.length ? (
            <AppText variant="caption" muted center style={styles.hint}>
              {t('messages.longPressHint')}
            </AppText>
          ) : undefined
        }
        ListEmptyComponent={
          inbox.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.empty} />
          ) : (
            <AppText muted center style={styles.empty}>
              {folder === 'primary' ? t('messages.emptyPrimary') : t('messages.emptyRequests')}
            </AppText>
          )
        }
      />
      <ActionMenu
        visible={!!selected}
        title={selected ? `@${selected.other_username}` : undefined}
        cancelLabel={t('common.cancel')}
        onClose={() => setSelected(null)}
        items={selected ? [{ label: t('messages.deleteConversation'), destructive: true, onPress: () => void remove(selected) }] : []}
      />
    </SafeAreaView>
  );
}

function InboxRow({ item, onLongPress }: { item: InboxItem; onLongPress: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const preview = item.last_has_media && !item.last_body ? t('messages.photo') : (item.last_body ?? '');
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.other_id}`)} onLongPress={onLongPress} delayLongPress={350}>
      <Avatar uri={publicUrl(item.other_avatar_path)} name={item.other_username} size={54} />
      <View style={styles.flex}>
        <AppText variant={item.unread ? 'bodyStrong' : 'body'} numberOfLines={1}>
          {item.other_username}
        </AppText>
        <AppText variant="caption" muted={!item.unread} numberOfLines={1}>
          {item.last_from_me ? t('messages.you') : ''}
          {preview} · {timeAgo(item.last_message_at, t, i18n.language)}
        </AppText>
      </View>
      {item.unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { padding: spacing.xl },
  hint: { padding: spacing.lg },
});
