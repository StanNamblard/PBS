import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { useAuth } from '@/features/auth/AuthProvider';
import { CAPTION_MAX, createPost, POST_MAX_PHOTOS } from '@/features/social/api';
import { useInvalidateContent } from '@/features/social/hooks';
import { pickFromLibrary, takePhoto } from '@/features/social/pickImages';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { notify } from '@/lib/dialogs';

export default function CreatePostScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const invalidate = useInvalidateContent();
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const remaining = POST_MAX_PHOTOS - photos.length;

  const add = async (source: 'library' | 'camera') => {
    const uris = source === 'library' ? await pickFromLibrary(remaining) : await takePhoto();
    if (uris === null) return notify(t('create.cameraPermission'));
    setPhotos((prev) => [...prev, ...uris].slice(0, POST_MAX_PHOTOS));
  };

  const publish = async () => {
    if (!userId || photos.length === 0) return;
    setProgress({ done: 0, total: photos.length });
    try {
      await createPost(userId, photos, caption, (done, total) => setProgress({ done, total }));
      await invalidate();
      router.dismissTo('/home');
    } catch (e) {
      const key = serverErrorKey(e);
      notify(t(key === 'errors.generic' ? 'errors.upload' : key));
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header close title={t('create.post')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {photos.map((uri, i) => (
            <View key={uri + i}>
              <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              <Pressable
                hitSlop={8}
                style={styles.removeThumb}
                onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
              >
                <Feather name="x" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          {remaining > 0 ? (
            <View style={styles.addColumn}>
              <AddTile icon="image" label={t('create.fromLibrary')} onPress={() => void add('library')} />
              <AddTile icon="camera" label={t('create.fromCamera')} onPress={() => void add('camera')} />
            </View>
          ) : null}
        </ScrollView>
        <AppText variant="caption" muted>
          {t('create.photosCount', { n: photos.length })}
        </AppText>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t('create.caption')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={CAPTION_MAX}
          style={[typography.body, styles.caption, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={progress ? t('create.publishing', progress) : t('create.publish')}
          loading={!!progress}
          disabled={photos.length === 0}
          onPress={() => void publish()}
        />
      </View>
    </SafeAreaView>
  );
}

function AddTile({ icon, label, onPress }: { icon: 'image' | 'camera'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.addTile, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Feather name={icon} size={22} color={colors.primary} />
      <AppText variant="caption" center numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

const THUMB = 150;
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  thumbs: { gap: spacing.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md },
  removeThumb: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
  addColumn: { gap: spacing.sm },
  addTile: { width: THUMB, height: (THUMB - spacing.sm) / 2, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, padding: spacing.xs },
  caption: { minHeight: 120, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, textAlignVertical: 'top' },
  footer: { padding: spacing.lg },
});
