import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { publicUrl } from '@/lib/media';
import { spacing } from '@/theme/tokens';
import type { UserRowData } from '@/features/social/types';

import { AppText } from './AppText';
import { Avatar } from './Avatar';

/** Ligne « avatar + pseudo » cliquable, avec une action à droite. */
export function UserRow({ user, right }: { user: UserRowData; right?: ReactNode }) {
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/user/${user.id}`)}>
      <Avatar uri={publicUrl(user.avatar_path)} name={user.username} size={48} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {user.username}
        </AppText>
        {user.display_name ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {user.display_name}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  text: { flex: 1 },
});
