import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Brightness from 'expo-brightness';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { getMyQrToken, regenerateQrToken } from '@/features/qr/api';
import { buildQrPayload, parseQrPayload } from '@/features/qr/payload';
import { confirm, notify } from '@/lib/dialogs';
import { publicUrl } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, spacing } from '@/theme/tokens';

type Mode = 'code' | 'scan';

/** Onglet QR : afficher mon code / scanner celui d'un ami. */
export default function QrScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('code');

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="title">{t('qr.title')}</AppText>
        <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
          {(['code', 'scan'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => setMode(m)}
              style={[styles.segmentItem, mode === m && { backgroundColor: colors.surface }]}
            >
              <AppText variant="bodyStrong" muted={mode !== m}>
                {m === 'code' ? t('qr.myCode') : t('qr.scan')}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
      {mode === 'code' ? <MyCode /> : <Scanner />}
    </SafeAreaView>
  );
}

function MyCode() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const { data: token, isPending } = useQuery({
    queryKey: ['qrToken', userId],
    enabled: !!userId,
    queryFn: () => getMyQrToken(userId!),
    staleTime: Infinity,
  });
  const [regenerating, setRegenerating] = useState(false);

  // Luminosité au maximum tant que le code est affiché (meilleure lecture), puis restaurée
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      let previous: number | null = null;
      void Brightness.getBrightnessAsync()
        .then((b) => {
          previous = b;
          return Brightness.setBrightnessAsync(1);
        })
        .catch(() => undefined);
      return () => {
        if (previous !== null) void Brightness.setBrightnessAsync(previous).catch(() => undefined);
      };
    }, []),
  );

  const regenerate = async () => {
    if (!userId) return;
    const ok = await confirm({ title: t('qr.regenerate'), message: t('qr.regenerateConfirm'), confirmText: t('common.continue'), cancelText: t('common.cancel') });
    if (!ok) return;
    setRegenerating(true);
    try {
      const fresh = await regenerateQrToken(userId);
      qc.setQueryData(['qrToken', userId], fresh);
      notify(t('qr.regenerated'));
    } catch {
      notify(t('errors.generic'));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <View style={styles.codeArea}>
      <View style={styles.card}>
        {/* Fond blanc obligatoire pour un bon contraste, même en mode sombre */}
        {token ? (
          <QRCode value={buildQrPayload(token)} size={230} color="#0B0B0F" backgroundColor="#FFFFFF" ecl="M" />
        ) : isPending ? (
          <ActivityIndicator color={palette.flash} style={{ height: 230 }} />
        ) : null}
        <View style={styles.identity}>
          <Avatar uri={publicUrl(profile?.avatar_path)} name={profile?.username} size={36} />
          <AppText variant="subtitle" color="#0B0B0F">
            @{profile?.username}
          </AppText>
        </View>
      </View>
      <AppText muted center>
        {t('qr.myCodeHint')}
      </AppText>
      <Button variant="ghost" label={t('qr.regenerate')} loading={regenerating} onPress={() => void regenerate()} />
      <View style={{ height: spacing.md, backgroundColor: colors.background }} />
    </View>
  );
}

function Scanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const [active, setActive] = useState(true);

  // La caméra ne tourne que quand l'onglet est affiché
  useFocusEffect(
    useCallback(() => {
      busy.current = false;
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.codeArea}>
        <AppText muted center>
          {t('qr.cameraPermissionBody')}
        </AppText>
        {permission.canAskAgain ? (
          <Button label={t('selfie.allowCamera')} onPress={() => void requestPermission()} />
        ) : (
          <Button label={t('selfie.openSettings')} onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.scanArea}>
      {active ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (busy.current) return;
            const token = parseQrPayload(data);
            if (!token) {
              setMessage(t('qr.notBps'));
              return;
            }
            busy.current = true;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push(`/q/${token}`);
          }}
        />
      ) : null}
      <View style={styles.viewfinderWrap} pointerEvents="none">
        <View style={[styles.viewfinder, { borderColor: colors.primary }]} />
      </View>
      <View style={styles.scanHint} pointerEvents="none">
        <AppText variant="bodyStrong" color="#FFFFFF" center>
          {message ?? t('qr.scanHint')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.md },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  codeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  card: { backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scanArea: { flex: 1, backgroundColor: '#000', marginHorizontal: spacing.md, marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  viewfinderWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  viewfinder: { width: 240, height: 240, borderWidth: 4, borderRadius: radius.lg },
  scanHint: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl, backgroundColor: 'rgba(0,0,0,0.55)', padding: spacing.md, borderRadius: radius.md },
});
