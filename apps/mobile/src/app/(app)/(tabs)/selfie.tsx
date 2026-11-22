import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SelfieButton } from '@/components/SelfieButton';
import { flagEmoji } from '@/features/onboarding/CountryPicker';
import { formatTime, selfieKeys, usePendingSelfie, useRecentMatches } from '@/features/selfie/hooks';
import { ensureNotificationPermission, nextWave, scheduleDailyReminders } from '@/features/selfie/reminders';
import { useSignedUrls } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Accueil du selfie du jour : LE bouton, la prochaine vague, les échanges des dernières 24 h. */
export default function SelfieHubScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const pending = usePendingSelfie();
  const recent = useRecentMatches();
  const matches = recent.data ?? [];
  const { data: urls } = useSignedUrls('selfies', matches.map((m) => m.their_selfie_path).filter((p): p is string => !!p));
  const [wave] = useState(() => nextWave());

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: ['selfie'] });
    }, [qc]),
  );

  // Première visite : demande l'autorisation des rappels quotidiens et les programme
  useEffect(() => {
    void ensureNotificationPermission().then(() => scheduleDailyReminders());
  }, []);

  const start = () => {
    if (pending.data) router.push(`/selfie/waiting/${pending.data.submission_id}`);
    else router.push('/selfie/camera');
  };

  const waveLabel = wave
    ? t('selfie.nextWave', {
        when:
          new Date(wave).toDateString() === new Date().toDateString()
            ? t('selfie.today', { time: formatTime(wave, i18n.language) })
            : t('selfie.tomorrow', { time: formatTime(wave, i18n.language) }),
      })
    : null;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl tintColor={colors.primary} refreshing={recent.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: ['selfie'] })} />
        }
      >
        <AppText variant="title">{t('selfie.title')}</AppText>
        <AppText muted>{t('selfie.body')}</AppText>

        <View style={styles.hero}>
          <SelfieButton size={150} accessibilityLabel={t('selfie.cta')} onPress={start} />
          <AppText variant="subtitle">{pending.data ? t('selfie.resume') : t('selfie.cta')}</AppText>
          {waveLabel ? (
            <AppText variant="caption" color={colors.primary}>
              {waveLabel}
            </AppText>
          ) : null}
        </View>

        <AppText variant="subtitle">{t('selfie.recent')}</AppText>
        {matches.length === 0 ? (
          <AppText muted>{t('selfie.noRecent')}</AppText>
        ) : (
          <View style={styles.grid}>
            {matches.map((m) => {
              const uri = m.their_selfie_path ? urls?.[m.their_selfie_path] : undefined;
              return (
                <Pressable key={m.match_id} style={styles.card} onPress={() => router.push(`/match/${m.match_id}`)}>
                  <Image
                    source={uri && m.their_selfie_path ? { uri, cacheKey: m.their_selfie_path } : undefined}
                    style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
                    contentFit="cover"
                    transition={200}
                  />
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {m.other_country_code ? `${flagEmoji(m.other_country_code)} ` : ''}
                    {m.other_username}
                  </AppText>
                  <AppText variant="caption" muted>
                    {t('selfie.expiresAt', { time: formatTime(m.media_expires_at, i18n.language) })}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
        {pending.data ? <Button variant="ghost" label={t('selfie.resume')} onPress={start} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { width: '47%', gap: 4 },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
});
