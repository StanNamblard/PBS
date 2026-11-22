import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { publicUrl } from '@/lib/media';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

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

  const confirmDelete = () =>
    Alert.alert(t('post.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('post.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post);
            await invalidate();
            onDeleted?.();
          } catch {
            Alert.alert(t('errors.generic'));
          }
        },
      },
    ]);

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
        {mine ? (
          <Pressable hitSlop={12} accessibilityLabel={t('post.delete')} onPress={confirmDelete}>
            <Feather name="more-horizontal" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
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
});
