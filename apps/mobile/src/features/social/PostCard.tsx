import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { ReportSheet } from '@/features/selfie/ReportSheet';
import { publicUrl } from '@/lib/media';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { confirm, notify } from '@/lib/dialogs';

import { deletePost } from './api';
import { useInvalidateContent } from './hooks';
import { MediaCarousel } from './MediaCarousel';
import type { Post } from './types';

export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const invalidate = useInvalidateContent();
  const mine = post.author_id === userId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const confirmDelete = async () => {
    const ok = await confirm({ title: t('post.deleteConfirm'), confirmText: t('post.delete'), cancelText: t('common.cancel'), destructive: true });
    if (!ok) return;
    try {
      await deletePost(post);
      await invalidate();
      onDeleted?.();
    } catch {
      notify(t('errors.generic'));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.author} onPress={() => router.push(`/user/${post.author_id}`)}>
          <Avatar uri={publicUrl(post.avatar_path)} name={post.username} size={34} />
          <AppText variant="bodyStrong">{post.username}</AppText>
          <AppText variant="caption" muted>
            · {timeAgo(post.created_at, t, i18n.language)}
          </AppText>
        </Pressable>
        <Pressable hitSlop={12} accessibilityLabel={t('profile.more')} onPress={() => setMenuOpen(true)}>
          <Feather name="more-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>
      {mine && post.moderation === 'pending' ? (
        <AppText variant="caption" color={colors.primary} style={styles.pending}>
          {t('post.pending')}
        </AppText>
      ) : null}
      <ActionMenu
        visible={menuOpen}
        cancelLabel={t('common.cancel')}
        onClose={() => setMenuOpen(false)}
        items={
          mine
            ? [{ label: t('post.delete'), destructive: true, onPress: () => void confirmDelete() }]
            : [{ label: t('post.report'), destructive: true, onPress: () => setReportOpen(true) }]
        }
      />
      {!mine ? (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetId={post.author_id}
          username={post.username}
          context="post"
          contextId={post.id}
        />
      ) : null}
      <MediaCarousel media={post.media} />
      {post.caption ? (
        <AppText style={styles.caption}>
          <AppText variant="bodyStrong">{post.username} </AppText>
          {post.caption}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  caption: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  pending: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
