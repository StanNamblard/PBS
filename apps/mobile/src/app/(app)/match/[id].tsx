import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { countryName, flagEmoji } from '@/features/onboarding/CountryPicker';
import { decideMatch } from '@/features/selfie/api';
import { formatTime, selfieKeys, useMatch } from '@/features/selfie/hooks';
import { ReportSheet } from '@/features/selfie/ReportSheet';
import { notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { publicUrl, useSignedUrls } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Phase = 'loading' | 'countdown' | 'revealed';

/**
 * Résultat d'un échange. Avec ?reveal=1 (arrivée depuis l'attente) :
 * compte à rebours 3-2-1 → flash → révélation des deux selfies.
 */
export default function MatchScreen() {
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const { data: match, isPending } = useMatch(id);
  const paths = [match?.their_selfie_path, match?.my_selfie_path].filter((p): p is string => !!p);
  const { data: urls } = useSignedUrls('selfies', paths);
  const [phase, setPhase] = useState<Phase>(reveal === '1' ? 'loading' : 'revealed');
  const [count, setCount] = useState(3);
  const [reportOpen, setReportOpen] = useState(false);

  const theirUrl = match?.their_selfie_path ? urls?.[match.their_selfie_path] : undefined;
  const myUrl = match?.my_selfie_path ? urls?.[match.my_selfie_path] : undefined;

  // Animation de révélation
  const flash = useSharedValue(0);
  const photo = useSharedValue(reveal === '1' ? 0 : 1);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const photoStyle = useAnimatedStyle(() => ({ opacity: photo.value, transform: [{ scale: 1.15 - 0.15 * photo.value }] }));

  // 1. Précharge les deux photos, puis lance le compte à rebours
  useEffect(() => {
    if (phase !== 'loading' || !theirUrl) return;
    let cancelled = false;
    void Image.prefetch([theirUrl, myUrl].filter((u): u is string => !!u))
      .catch(() => undefined)
      .then(() => !cancelled && setPhase('countdown'));
    return () => {
      cancelled = true;
    };
  }, [phase, theirUrl, myUrl]);

  // 2. 3… 2… 1…
  useEffect(() => {
    if (phase !== 'countdown') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (count === 0) {
      setPhase('revealed');
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 750);
    return () => clearTimeout(timer);
  }, [phase, count]);

  // 3. Flash blanc + la photo « se développe »
  useEffect(() => {
    if (phase !== 'revealed' || reveal !== '1') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    flash.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 650 }));
    photo.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [phase, reveal, flash, photo]);

  const decide = useMutation({
    mutationFn: (d: 'follow' | 'pass') => decideMatch(id, d),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: selfieKeys.match(id) });
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e) => notify(t(serverErrorKey(e))),
  });

  if (isPending) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  if (!match) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <Header close />
        <AppText muted center style={styles.pad}>
          {t('match.notFound')}
        </AppText>
      </SafeAreaView>
    );
  }

  const expired = !match.their_selfie_path;
  const photoWidth = width - spacing.lg * 2;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header close title={phase === 'revealed' ? t('match.itsAMatch') : t('match.countdown')} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Photos */}
        <View style={[styles.photoFrame, { width: photoWidth, height: (photoWidth * 4) / 3, backgroundColor: colors.surfaceAlt }]}>
          {expired ? (
            <View style={styles.centerFill}>
              <Feather name="clock" size={36} color={colors.textMuted} />
              <AppText muted center>
                {t('match.expired')}
              </AppText>
            </View>
          ) : phase === 'revealed' ? (
            <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
              <Image source={theirUrl ? { uri: theirUrl, cacheKey: match.their_selfie_path ?? undefined } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" />
              {myUrl ? (
                <View style={[styles.pip, { borderColor: colors.background }]}>
                  <Image source={{ uri: myUrl, cacheKey: match.my_selfie_path ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              ) : null}
            </Animated.View>
          ) : (
            // Avant la révélation : visuel abstrait, AUCUN dérivé de la vraie photo
            <View style={[styles.centerFill, { backgroundColor: colors.primary }]}>
              {phase === 'countdown' && count > 0 ? (
                <AppText style={styles.count} color="#FFFFFF">
                  {count}
                </AppText>
              ) : (
                <ActivityIndicator color="#FFFFFF" size="large" />
              )}
            </View>
          )}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
        </View>

        {phase === 'revealed' ? (
          <>
            {/* Profil de l'autre */}
            <Pressable style={styles.person} onPress={() => router.push(`/user/${match.other_id}`)}>
              <Avatar uri={publicUrl(match.other_avatar_path)} name={match.other_username} size={52} />
              <View style={styles.flex}>
                <AppText variant="subtitle">@{match.other_username}</AppText>
                {match.other_country_code ? (
                  <AppText variant="caption" muted>
                    {flagEmoji(match.other_country_code)} {countryName(match.other_country_code, i18n.language)}
                  </AppText>
                ) : null}
              </View>
              <Feather name="chevron-right" size={22} color={colors.textMuted} />
            </Pressable>
            {match.other_bio ? <AppText>{match.other_bio}</AppText> : null}
            {match.follows_me ? (
              <AppText variant="caption" color={colors.primary}>
                {t('match.followsYou', { username: match.other_username })}
              </AppText>
            ) : null}

            {/* Décision */}
            {match.my_decision === 'pending' && !match.i_follow ? (
              <View style={styles.row}>
                <Button variant="secondary" label={t('match.pass')} style={styles.flex} disabled={decide.isPending} onPress={() => decide.mutate('pass')} />
                <Button label={t('match.follow')} style={styles.flex} loading={decide.isPending} onPress={() => decide.mutate('follow')} />
              </View>
            ) : (
              <AppText variant="bodyStrong" center>
                {match.i_follow === 'active'
                  ? t('match.followed', { username: match.other_username })
                  : match.i_follow === 'requested'
                    ? t('match.requested', { username: match.other_username })
                    : t('match.passed')}
              </AppText>
            )}

            <Button label={t('match.again')} onPress={() => router.replace('/selfie/camera')} />
            {!expired ? (
              <AppText variant="caption" muted center>
                {t('selfie.expiresAt', { time: formatTime(match.media_expires_at, i18n.language) })}
              </AppText>
            ) : null}
            <Pressable onPress={() => setReportOpen(true)} style={styles.report}>
              <Feather name="flag" size={16} color={colors.danger} />
              <AppText variant="caption" color={colors.danger}>
                {t('match.report')}
              </AppText>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={match.other_id}
        username={match.other_username}
        context="selfie"
        contextId={match.match_id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 120 },
  pad: { padding: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.md, paddingTop: 0 },
  photoFrame: { borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center' },
  centerFill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  count: { fontSize: 120, lineHeight: 130, fontFamily: 'BricolageGrotesque_700Bold' },
  flash: { backgroundColor: '#FFFFFF' },
  pip: { position: 'absolute', top: spacing.md, right: spacing.md, width: 96, height: 128, borderRadius: radius.md, borderWidth: 3, overflow: 'hidden' },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
});
