import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { publicUrl } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { useStoryTray } from './hooks';

const SIZE = 64;

/**
 * Bandeau des stories en haut de l'accueil : ma story (ou « + » pour en créer
 * une), puis les comptes suivis — non vues d'abord (anneau coloré).
 */
export function StoryTray() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const { data: me } = useMyProfile();
  const { data: tray = [] } = useStoryTray();

  const mine = tray.find((i) => i.is_me);
  const others = tray.filter((i) => !i.is_me);
  const queue = others.map((o) => o.author_id);

  const open = (authorId: string) => {
    const rest = authorId === userId ? [] : queue.slice(queue.indexOf(authorId) + 1);
    router.push({ pathname: '/story/[userId]', params: { userId: authorId, next: rest.join(',') } });
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable style={styles.item} onPress={() => (mine && userId ? open(userId) : router.push('/create/story'))}>
        <Ring active={!!mine} seen={false}>
          <Avatar uri={publicUrl(me?.avatar_path)} name={me?.username} size={SIZE} />
        </Ring>
        {!mine ? (
          <View style={[styles.plus, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Feather name="plus" size={14} color={colors.onPrimary} />
          </View>
        ) : null}
        <AppText variant="caption" numberOfLines={1} style={styles.label}>
          {t('home.yourStory')}
        </AppText>
      </Pressable>
      {others.map((item) => (
        <Pressable key={item.author_id} style={styles.item} onPress={() => open(item.author_id)}>
          <Ring active seen={!item.has_unseen}>
            <Avatar uri={publicUrl(item.avatar_path)} name={item.username} size={SIZE} />
          </Ring>
          <AppText variant="caption" numberOfLines={1} style={styles.label} muted={!item.has_unseen}>
            {item.username}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Ring({ active, seen, children }: { active: boolean; seen: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const ringColors: [string, string] = !active
    ? [colors.background, colors.background]
    : seen
      ? [colors.border, colors.border]
      : [colors.primary, colors.primaryAlt];
  return (
    <LinearGradient colors={ringColors} style={styles.ring}>
      <View style={[styles.gap, { backgroundColor: colors.background }]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  item: { width: SIZE + 8, alignItems: 'center' },
  ring: { width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, alignItems: 'center', justifyContent: 'center' },
  gap: { padding: 2, borderRadius: (SIZE + 4) / 2 },
  plus: { position: 'absolute', right: 0, top: SIZE - 14, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 4, maxWidth: SIZE + 8 },
});
