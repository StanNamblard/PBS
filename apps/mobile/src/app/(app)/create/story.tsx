import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { useAuth } from '@/features/auth/AuthProvider';
import { createStory } from '@/features/social/api';
import { useInvalidateContent } from '@/features/social/hooks';
import { pickFromLibrary, takePhoto } from '@/features/social/pickImages';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { notify } from '@/lib/dialogs';

export default function CreateStoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const invalidate = useInvalidateContent();
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const choose = async (source: 'library' | 'camera') => {
    const uris = source === 'library' ? await pickFromLibrary(1) : await takePhoto();
    if (uris === null) return notify(t('create.cameraPermission'));
    if (uris[0]) setPhoto(uris[0]);
  };

  const share = async () => {
    if (!userId || !photo) return;
    setLoading(true);
    try {
      await createStory(userId, photo);
      await invalidate();
      router.dismissTo('/home');
    } catch (e) {
      const key = serverErrorKey(e);
      notify(t(key === 'errors.generic' ? 'errors.upload' : key));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header close title={t('create.story')} />
      <View style={styles.previewWrap}>
        <View style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}>
          {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
      </View>
      <View style={styles.footer}>
        {photo ? (
          <>
            <Button label={t('create.shareStory')} loading={loading} onPress={() => void share()} />
            <Button variant="ghost" label={t('create.fromLibrary')} disabled={loading} onPress={() => void choose('library')} />
          </>
        ) : (
          <>
            <Button label={t('create.fromCamera')} onPress={() => void choose('camera')} />
            <Button variant="secondary" label={t('create.fromLibrary')} onPress={() => void choose('library')} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  previewWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  preview: { height: '100%', aspectRatio: 9 / 16, borderRadius: radius.lg, overflow: 'hidden' },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
