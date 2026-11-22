import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { cancelSelfie, pollSelfie } from '@/features/selfie/api';
import { confirm } from '@/lib/dialogs';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const POLL_MS = 3000;

/** Attente d'un partenaire : interroge le serveur toutes les 3 s (ce qui relance aussi le matching). */
export default function WaitingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['selfie', 'poll', id],
    queryFn: () => pollSelfie(id),
    refetchInterval: (q) => (q.state.data?.status === 'pending' || !q.state.data ? POLL_MS : false),
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.status === 'matched' && data.match_id) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ['selfie'] });
      router.replace({ pathname: '/match/[id]', params: { id: data.match_id, reveal: '1' } });
    }
    if (data?.status === 'cancelled') router.back();
  }, [data, qc]);

  const cancel = async () => {
    const ok = await confirm({ title: t('selfie.cancelConfirm'), confirmText: t('selfie.cancel'), cancelText: t('common.back'), destructive: true });
    if (!ok) return;
    await cancelSelfie(id).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ['selfie'] });
    router.back();
  };

  if (data?.status === 'expired') {
    return (
      <Screen
        footer={
          <>
            <Button label={t('selfie.tryAgain')} onPress={() => router.replace('/selfie/camera')} />
            <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
          </>
        }
      >
        <AppText variant="title">{t('selfie.expiredTitle')}</AppText>
        <AppText muted>{t('selfie.expiredBody')}</AppText>
      </Screen>
    );
  }

  const remainingMs = data ? Math.max(0, new Date(data.expires_at).getTime() - now) : 0;
  const mm = Math.floor(remainingMs / 60000);
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0');

  return (
    <Screen
      footer={
        <>
          <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
          <Button variant="ghost" label={t('selfie.cancel')} onPress={() => void cancel()} />
        </>
      }
    >
      <View style={styles.center}>
        <Searching />
        <AppText variant="title" center>
          {t('selfie.waitingTitle')}
        </AppText>
        <AppText muted center>
          {t('selfie.waitingBody')}
        </AppText>
        {data ? (
          <AppText variant="caption" muted center>
            {t('selfie.timeLeft', { time: `${mm}:${ss}` })}
          </AppText>
        ) : null}
        <AppText variant="caption" muted center>
          {t('selfie.waitingLeave')}
        </AppText>
      </View>
    </Screen>
  );
}

/** Ondes concentriques autour d'un globe : « quelque part dans le monde… » */
function Searching() {
  return (
    <View style={styles.searching}>
      {[0, 1, 2].map((i) => (
        <Ring key={i} delay={i * 700} />
      ))}
      <AppText style={styles.globe}>🌍</AppText>
    </View>
  );
}

function Ring({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2100, easing: Easing.out(Easing.quad) }), -1, false));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - v.value), transform: [{ scale: 0.4 + v.value * 1.2 }] }));
  return <Animated.View style={[styles.ring, { borderColor: colors.primary }, style]} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  searching: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  ring: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 3 },
  globe: { fontSize: 64, lineHeight: 76 },
});
