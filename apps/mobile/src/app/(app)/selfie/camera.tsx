import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { getPendingSelfie, newRequestId, sendSelfie } from '@/features/selfie/api';
import { composeDual } from '@/features/selfie/composeDual';
import { notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * Photo du jour : TOUJOURS prise en direct (jamais depuis la galerie), mais
 * libre : caméra avant, arrière, ou « Double » (arrière puis avant, assemblées
 * en une seule image). Montrer son visage n'est pas obligatoire.
 */
type Mode = 'front' | 'back' | 'dual';
const MODE_KEY = 'bps.selfieMode';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Shot {
  main: string; // photo principale (plein cadre)
  inset?: string; // mode Double : petite photo de la caméra avant
  requestId: string;
}

export default function SelfieCameraScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const composite = useRef<React.ComponentRef<typeof View>>(null);
  const [mode, setMode] = useState<Mode>('front');
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [sending, setSending] = useState(false);

  // Retient le dernier mode choisi
  useEffect(() => {
    void AsyncStorage.getItem(MODE_KEY).then((m) => {
      if (m === 'front' || m === 'back' || m === 'dual') selectMode(m);
    });
  }, []);

  function selectMode(m: Mode) {
    setMode(m);
    setFacing(m === 'front' ? 'front' : 'back');
    void AsyncStorage.setItem(MODE_KEY, m);
  }

  if (!permission) return <View style={styles.black} />;

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

  const take = async () => (await camera.current?.takePictureAsync({ quality: 0.9 }))?.uri;

  const shoot = async () => {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      if (mode !== 'dual') {
        const uri = await take();
        if (uri) setShot({ main: uri, requestId: newRequestId() });
        return;
      }
      // Mode Double : arrière, bascule, avant (moins d'une seconde d'écart)
      const back = await take();
      setReady(false);
      setFacing('front');
      await sleep(900); // le temps que la caméra avant démarre
      const front = await take();
      setFacing('back');
      if (back && front) setShot({ main: back, inset: front, requestId: newRequestId() });
    } catch {
      notify(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!shot || !userId) return;
    setSending(true);
    try {
      // Mode Double : une seule image assemblée (canvas sur le web, capture de la vue sur mobile)
      let uri = shot.main;
      if (shot.inset) {
        uri =
          Platform.OS === 'web'
            ? await composeDual(shot.main, shot.inset)
            : await captureRef(composite as never, { format: 'jpg', quality: 0.9, width: 1080, height: 1440 });
      }
      const state = await sendSelfie(userId, uri, shot.requestId);
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
      {shot ? (
        // Aperçu (et, en mode Double, la vue qui sera capturée en une seule image)
        <View style={styles.previewArea}>
          <View ref={composite} collapsable={false} style={styles.composite}>
            <Image source={{ uri: shot.main }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {shot.inset ? (
              <View style={styles.inset}>
                <Image source={{ uri: shot.inset }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mirror={facing === 'front'}
          animateShutter
          onCameraReady={() => setReady(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel={t('common.back')}>
            <Feather name="x" size={30} color="#FFFFFF" />
          </Pressable>
          {!shot && mode !== 'dual' ? (
            <Pressable
              hitSlop={12}
              accessibilityLabel={t('selfie.flip')}
              onPress={() => selectMode(mode === 'front' ? 'back' : 'front')}
              style={styles.flip}
            >
              <Feather name="refresh-cw" size={24} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.flex} pointerEvents="none" />

        {shot ? (
          <View style={styles.actions}>
            <Button variant="secondary" label={t('selfie.retake')} disabled={sending} onPress={() => setShot(null)} style={styles.flex} />
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
            {/* Choix du mode */}
            <View style={styles.modes}>
              {(['front', 'back', 'dual'] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === m }}
                  onPress={() => selectMode(m)}
                  style={[styles.modeChip, mode === m && { backgroundColor: colors.primary }]}
                >
                  <AppText variant="caption" color="#FFFFFF" style={styles.modeText}>
                    {t(`selfie.mode_${m}`)}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.85)" center>
              {mode === 'dual' ? t('selfie.dualHint') : t('selfie.liveOnly')}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('selfie.cta')}
              disabled={!ready || busy}
              onPress={() => void shoot()}
              style={({ pressed }) => [styles.shutter, { borderColor: colors.primary, opacity: ready && !busy ? (pressed ? 0.7 : 1) : 0.4 }]}
            >
              {ready && !busy ? <View style={[styles.shutterInner, { backgroundColor: '#FFFFFF' }]} /> : <ActivityIndicator color="#FFFFFF" />}
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  flip: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 22, padding: spacing.sm },
  previewArea: { flex: 1, justifyContent: 'center' },
  composite: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#000', overflow: 'hidden' },
  inset: { position: 'absolute', top: spacing.md, left: spacing.md, width: '30%', aspectRatio: 3 / 4, borderRadius: radius.md, borderWidth: 3, borderColor: '#000', overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  shutterArea: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  modes: { flexDirection: 'row', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.pill, padding: 4 },
  modeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  modeText: { fontWeight: '600' },
  shutter: { width: 86, height: 86, borderRadius: 43, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: radius.pill },
});
