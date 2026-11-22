import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { SmallButton } from '@/components/SmallButton';
import { UserRow } from '@/components/UserRow';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { FollowButton } from './FollowButton';
import { useFollowActions, useFollowList, useProfile } from './hooks';

/** Liste des abonnés ou des abonnements d'un profil. */
export function FollowListScreen({ userId, kind }: { userId: string; kind: 'followers' | 'following' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId: me } = useAuth();
  const { data: profile } = useProfile(userId);
  const list = useFollowList(kind, userId);
  const { remove } = useFollowActions();
  const users = list.data?.pages.flat() ?? [];
  const isMine = userId === me;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={kind === 'followers' ? t('profile.followers') : t('profile.following')} />
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        onEndReached={() => list.hasNextPage && void list.fetchNextPage()}
        ListEmptyComponent={
          list.isPending ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <AppText muted center style={{ padding: spacing.xl }}>
              {profile && !profile.can_view ? t('profile.privateList') : t('profile.emptyList')}
            </AppText>
          )
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            right={
              item.id === me ? null : isMine && kind === 'followers' ? (
                <SmallButton
                  label={t('profile.removeFollower')}
                  onPress={() =>
                    Alert.alert(t('profile.removeFollowerConfirm', { username: item.username }), undefined, [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('profile.removeFollower'), style: 'destructive', onPress: () => remove.mutate(item.id) },
                    ])
                  }
                />
              ) : (
                <FollowButton userId={item.id} username={item.username} status={item.i_follow} />
              )
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
