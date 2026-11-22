import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { getPendingSelfie, newRequestId, sendSelfie } from '@/features/selfie/api';
import { notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * Prise du selfie : caméra FRONTALE uniquement, aucune importation depuis la
 * galerie (authenticité du jeu).
 */
export default function SelfieCameraScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; requestId: string } | null>(null);
  const [sending, setSending] = useState(false);

  if (!permission) {
    return <View style={styles.black} />;
  }

  if (!permission.granted) {
    return (
      <Screen
        footer={
          <>
            {permission.canAskAgain ? (
              <Button label={t('selfie.allowCamera')} onPress={() => void requestPermission()} />
            ) : (
              <Button label={t('selfie.openSettings')} onPress={() => void Linking.openSettings()} />
            )}
            <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
          </>
        }
      >
        <AppText variant="title">{t('selfie.cameraPermissionTitle')}</AppText>
        <AppText muted>{t('selfie.cameraPermissionBody')}</AppText>
      </Screen>
    );
  }

  const shoot = async () => {
    if (!camera.current || !ready) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const picture = await camera.current.takePictureAsync({ quality: 0.9 });
    if (picture?.uri) setPhoto({ uri: picture.uri, requestId: newRequestId() });
  };

  const send = async () => {
    if (!photo || !userId) return;
    setSending(true);
    try {
      const state = await sendSelfie(userId, photo.uri, photo.requestId);
      await qc.invalidateQueries({ queryKey: ['selfie'] });
      if (state.status === 'matched' && state.match_id) {
        router.replace({ pathname: '/match/[id]', params: { id: state.match_id, reveal: '1' } });
      } else {
        router.replace(`/selfie/waiting/${state.submission_id}`);
      }
    } catch (e) {
      const key = serverErrorKey(e);
      if (key === 'selfie.selfie_already_pending') {
        const pending = await getPendingSelfie().catch(() => null);
        if (pending) return router.replace(`/selfie/waiting/${pending.submission_id}`);
      }
      notify(t(key === 'errors.generic' ? 'errors.upload' : key));
      setSending(false);
    }
  };

  return (
    <View style={styles.black}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="front"
          mirror
          animateShutter
          onCameraReady={() => setReady(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel={t('common.back')}>
            <Feather name="x" size={30} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.flex} pointerEvents="none" />
        {photo ? (
          <View style={styles.actions}>
            <Button variant="secondary" label={t('selfie.retake')} disabled={sending} onPress={() => setPhoto(null)} style={styles.flex} />
            <Button
              label={sending ? t('selfie.sending') : t('selfie.send')}
              loading={sending}
              onPress={() => void send()}
              style={styles.flex}
              icon={sending ? undefined : <Feather name="send" size={18} color={colors.onPrimary} />}
            />
          </View>
        ) : (
          <View style={styles.shutterArea}>
            <AppText variant="caption" color="rgba(255,255,255,0.85)" center>
              {t('selfie.frontOnly')}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('selfie.cta')}
              disabled={!ready}
              onPress={() => void shoot()}
              style={({ pressed }) => [styles.shutter, { borderColor: colors.primary, opacity: ready ? (pressed ? 0.7 : 1) : 0.4 }]}
            >
              {ready ? <View style={[styles.shutterInner, { backgroundColor: '#FFFFFF' }]} /> : <ActivityIndicator color="#FFFFFF" />}
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill },
  top: { flexDirection: 'row', padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  shutterArea: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  shutter: { width: 86, height: 86, borderRadius: 43, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: radius.pill },
});
