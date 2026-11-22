import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSignedUrls } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import type { MediaItem } from './types';

/** Ratio d'affichage borné comme sur les réseaux photo (entre 4:5 et 1.91:1). */
export function displayRatio(media: MediaItem | undefined): number {
  if (!media?.width || !media?.height) return 1;
  const r = media.width / media.height;
  return Math.min(1.91, Math.max(0.8, r));
}

/** Photo unique ou carrousel horizontal avec indicateur de position. */
export function MediaCarousel({ media }: { media: MediaItem[] }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const { data: urls } = useSignedUrls('posts', media.map((m) => m.path));
  const height = width / displayRatio(media[0]);

  return (
    <View>
      <FlatList
        data={media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => m.path}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Image
            source={urls?.[item.path] ? { uri: urls[item.path], cacheKey: item.path } : undefined}
            style={{ width, height, backgroundColor: colors.surfaceAlt }}
            contentFit="cover"
            transition={200}
          />
        )}
      />
      {media.length > 1 ? (
        <View style={styles.dots}>
          {media.map((m, i) => (
            <View key={m.path} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
