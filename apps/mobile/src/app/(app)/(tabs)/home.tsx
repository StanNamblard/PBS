import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useFeed, useStoryTray } from '@/features/social/hooks';
import { PostCard } from '@/features/social/PostCard';
import { StoryTray } from '@/features/social/StoryTray';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Accueil : stories en haut, puis fil chronologique des comptes suivis. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const feed = useFeed();
  const tray = useStoryTray();
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.topBar}>
        <AppText variant="title" color={colors.primary}>
          {t('home.title')}
        </AppText>
        <Pressable accessibilityLabel={t('home.create')} hitSlop={12} onPress={() => router.push('/create')}>
          <Feather name="plus-square" size={26} color={colors.text} />
        </Pressable>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={<StoryTray />}
        ListEmptyComponent={
          feed.isPending ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <AppText muted center style={styles.empty}>
              {t('home.empty')}
            </AppText>
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined}
        onEndReachedThreshold={0.5}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={feed.isRefetching}
            onRefresh={() => {
              void feed.refetch();
              void tray.refetch();
            }}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  empty: { padding: spacing.xl },
});
