import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Placeholder } from '@/components/Placeholder';
import { Screen } from '@/components/Screen';
import { avatarUrl } from '@/features/onboarding/api';
import { countryName, flagEmoji } from '@/features/onboarding/CountryPicker';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function MyProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { data: profile, isPending } = useMyProfile();

  if (isPending || !profile) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="subtitle">@{profile.username}</AppText>
        <Pressable accessibilityLabel={t('profile.settings')} onPress={() => router.push('/settings')} hitSlop={12}>
          <Feather name="settings" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.identity}>
        <Avatar uri={avatarUrl(profile.avatar_path)} name={profile.display_name ?? profile.username} size={88} />
        <View style={styles.counters}>
          <Counter value={profile.posts_count} label={t('profile.posts')} />
          <Counter value={profile.followers_count} label={t('profile.followers')} />
          <Counter value={profile.following_count} label={t('profile.following')} />
        </View>
      </View>
      {profile.display_name ? <AppText variant="bodyStrong">{profile.display_name}</AppText> : null}
      {profile.country_code ? (
        <AppText variant="caption" muted>
          {flagEmoji(profile.country_code)} {countryName(profile.country_code, i18n.language)}
        </AppText>
      ) : null}
      {profile.bio ? <AppText>{profile.bio}</AppText> : null}
      <Placeholder badge={t('common.phase', { n: 2 })} text={t('common.comingSoon')} />
    </Screen>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.counter}>
      <AppText variant="subtitle">{value}</AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  counters: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  counter: { alignItems: 'center' },
});
