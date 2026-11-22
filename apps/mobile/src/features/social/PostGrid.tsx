import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSignedUrls } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';

import type { Post } from './types';

const GAP = 2;

/** Grille 3 colonnes de vignettes (première photo de chaque publication). */
export function PostGrid({ posts }: { posts: Post[] }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const size = (width - GAP * 2) / 3;
  const covers = posts.map((p) => p.media[0]?.path).filter((p): p is string => !!p);
  const { data: urls } = useSignedUrls('posts', covers);

  return (
    <View style={styles.grid}>
      {posts.map((post) => {
        const cover = post.media[0]?.path;
        const uri = cover ? urls?.[cover] : undefined;
        return (
          <Pressable key={post.id} onPress={() => router.push(`/post/${post.id}`)} style={{ width: size, height: size }}>
            <Image
              source={uri && cover ? { uri, cacheKey: cover } : undefined}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceAlt }]}
              contentFit="cover"
              transition={150}
            />
            {post.media.length > 1 ? (
              <Feather name="copy" size={16} color="#FFFFFF" style={styles.multi} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  multi: { position: 'absolute', top: 6, right: 6 },
});
