import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { getPost } from '@/features/social/api';
import { PostCard } from '@/features/social/PostCard';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: post, isPending } = useQuery({ queryKey: ['post', id], queryFn: () => getPost(id) });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={post ? `@${post.username}` : ''} />
      <ScrollView>
        {isPending ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : post ? (
          <PostCard post={post} onDeleted={() => router.back()} />
        ) : (
          <AppText muted center style={{ padding: spacing.xl }}>
            {t('post.notFound')}
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
