import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Header } from '@/components/Header';
import { SmallButton } from '@/components/SmallButton';
import { blockUser } from '@/features/messages/api';
import { supabase } from '@/lib/supabase';
import { countryName, flagEmoji } from '@/features/onboarding/CountryPicker';
import { ReportSheet } from '@/features/selfie/ReportSheet';
import { confirm, notify } from '@/lib/dialogs';
import { publicUrl } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { FollowButton } from './FollowButton';
import { useFollowRequests, useProfile, useStoryTray, useUserPosts } from './hooks';
import { PostGrid } from './PostGrid';

interface Props {
  userId: string;
  /** Onglet « Profil » : pas de bouton retour, icône paramètres */
  isTab?: boolean;
}

export function ProfileView({ userId, isTab }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const profileQuery = useProfile(userId);
  const profile = profileQuery.data;
  const canView = !!profile?.can_view;
  const postsQuery = useUserPosts(userId, canView);
  const { data: requests = [] } = useFollowRequests();
  const { data: tray = [] } = useStoryTray();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const muted = useQuery({
    queryKey: ['muted', userId],
    enabled: !!profile && !profile.is_me,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_muted', { p_target: userId });
      if (error) throw error;
      return data as boolean;
    },
  });
  const toggleMute = async () => {
    if (!profile) return;
    const fn = muted.data ? 'unmute_user' : 'mute_user';
    const { error } = await supabase.rpc(fn, { p_target: profile.id });
    if (error) return notify(t('errors.generic'));
    await qc.invalidateQueries({ queryKey: ['muted', userId] });
    await qc.invalidateQueries({ queryKey: ['feed'] });
    await qc.invalidateQueries({ queryKey: ['storyTray'] });
    notify(t(muted.data ? 'profile.unmuted' : 'profile.muted', { username: profile.username }));
  };

  if (profileQuery.isPending) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  if (!profile) {
    return (
      <View style={styles.flex}>
        <Header />
        <AppText muted center style={styles.empty}>
          {t('profile.notFound')}
        </AppText>
      </View>
    );
  }

  const posts = postsQuery.data?.pages.flat() ?? [];

  // Menu « ⋯ » d'un autre profil : signaler ou bloquer
  const block = async () => {
    const ok = await confirm({
      title: t('messages.blockConfirm', { username: profile.username }),
      confirmText: t('messages.block'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await blockUser(profile.id);
    await qc.invalidateQueries();
    notify(t('messages.blocked', { username: profile.username }));
    router.back();
  };

  const hasStory = tray.some((i) => i.author_id === userId);
  const openList = (kind: 'followers' | 'following') => router.push(`/user/${userId}/${kind}`);

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.identity}>
        <Pressable
          disabled={!hasStory}
          onPress={() => router.push({ pathname: '/story/[userId]', params: { userId, next: '' } })}
          style={[styles.avatarRing, hasStory && { borderColor: colors.primary }]}
        >
          <Avatar uri={publicUrl(profile.avatar_path)} name={profile.display_name ?? profile.username} size={86} />
        </Pressable>
        <View style={styles.counters}>
          <Counter value={profile.posts_count} label={t('profile.posts')} />
          <Counter value={profile.followers_count} label={t('profile.followers')} onPress={canView ? () => openList('followers') : undefined} />
          <Counter value={profile.following_count} label={t('profile.following')} onPress={canView ? () => openList('following') : undefined} />
        </View>
      </View>

      <View style={styles.bioBlock}>
        {profile.display_name ? <AppText variant="bodyStrong">{profile.display_name}</AppText> : null}
        {profile.country_code ? (
          <AppText variant="caption" muted>
            {flagEmoji(profile.country_code)} {countryName(profile.country_code, i18n.language)}
          </AppText>
        ) : null}
        {profile.bio ? <AppText>{profile.bio}</AppText> : null}
        {!profile.is_me && profile.follows_me ? (
          <AppText variant="caption" muted>
            {t('profile.followsYou')}
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {profile.is_me ? (
          <SmallButton flex label={t('profile.edit')} onPress={() => router.push('/edit-profile')} />
        ) : (
          <>
            <FollowButton flex userId={profile.id} username={profile.username} status={profile.i_follow} followsMe={profile.follows_me} />
            {/* On ne peut écrire qu'aux personnes qu'on suit */}
            {profile.i_follow === 'active' ? (
              <SmallButton flex label={t('messages.message')} onPress={() => router.push(`/chat/${profile.id}`)} />
            ) : null}
          </>
        )}
      </View>

      {profile.is_me && requests.length > 0 ? (
        <Pressable
          onPress={() => router.push('/follow-requests')}
          style={[styles.requests, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <AppText variant="bodyStrong">{t('profile.requests', { n: requests.length })}</AppText>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {!canView ? (
        <View style={[styles.private, { borderColor: colors.border }]}>
          <Feather name="lock" size={28} color={colors.text} />
          <AppText variant="bodyStrong">{t('profile.privateAccount')}</AppText>
          <AppText muted center>
            {t('profile.privateHint')}
          </AppText>
        </View>
      ) : posts.length === 0 && !postsQuery.isPending ? (
        <AppText muted center style={styles.empty}>
          {t('profile.noPosts')}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.flex}>
      <Header
        back={!isTab}
        title={`@${profile.username}`}
        right={
          profile.is_me ? (
            <Pressable hitSlop={12} accessibilityLabel={t('profile.settings')} onPress={() => router.push('/settings')}>
              <Feather name="settings" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <Pressable hitSlop={12} accessibilityLabel={t('profile.more')} onPress={() => setMenuOpen(true)}>
              <Feather name="more-horizontal" size={24} color={colors.text} />
            </Pressable>
          )
        }
      />
      {!profile.is_me ? (
        <ActionMenu
          visible={menuOpen}
          title={`@${profile.username}`}
          cancelLabel={t('common.cancel')}
          onClose={() => setMenuOpen(false)}
          items={[
            ...(profile.i_follow === 'active'
              ? [{ label: muted.data ? t('profile.unmute') : t('profile.mute'), onPress: () => void toggleMute() }]
              : []),
            { label: t('profile.reportUser'), onPress: () => setReportOpen(true) },
            { label: t('profile.blockUser'), destructive: true, onPress: () => void block() },
          ]}
        />
      ) : null}
      {!profile.is_me ? (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetId={profile.id}
          username={profile.username}
          context="profile"
          contextId={null}
        />
      ) : null}
      <FlatList
        data={canView && posts.length > 0 ? [posts] : []}
        keyExtractor={() => 'grid'}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostGrid posts={item} />}
        onEndReached={() => postsQuery.hasNextPage && void postsQuery.fetchNextPage()}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={profileQuery.isRefetching}
            onRefresh={() => {
              void profileQuery.refetch();
              void postsQuery.refetch();
            }}
          />
        }
      />
    </View>
  );
}

function Counter({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.counter} disabled={!onPress} onPress={onPress}>
      <AppText variant="subtitle">{value}</AppText>
      <AppText variant="caption" muted numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: spacing.xxl },
  headerBlock: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarRing: { borderWidth: 3, borderColor: 'transparent', borderRadius: 50, padding: 2 },
  counters: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', gap: spacing.xs },
  counter: { flex: 1, alignItems: 'center' },
  bioBlock: { gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  requests: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  private: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md },
  empty: { padding: spacing.xl },
});
