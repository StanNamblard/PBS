import { Image } from 'expo-image';
import { ScrollView, StyleSheet } from 'react-native';

import { publicUrl, useSignedUrls } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import type { MediaRef } from './api';

/** Photos concernées (les admins ont accès aux fichiers signalés). */
export function MediaStrip({ media, size = 150 }: { media: MediaRef[]; size?: number }) {
  const { colors } = useTheme();
  const byBucket = (b: 'posts' | 'stories' | 'selfies') => media.filter((m) => m.bucket === b).map((m) => m.path);
  const posts = useSignedUrls('posts', byBucket('posts'));
  const stories = useSignedUrls('stories', byBucket('stories'));
  const selfies = useSignedUrls('selfies', byBucket('selfies'));
  const urlOf = (m: MediaRef) =>
    m.bucket === 'avatars'
      ? publicUrl(m.path)
      : (m.bucket === 'posts' ? posts.data : m.bucket === 'stories' ? stories.data : selfies.data)?.[m.path];
  if (media.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {media.map((m) => {
        const uri = urlOf(m);
        return (
          <Image
            key={m.bucket + m.path}
            source={uri ? { uri } : undefined}
            style={{ width: size, height: (size * 4) / 3, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
            contentFit="cover"
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { gap: spacing.sm } });
