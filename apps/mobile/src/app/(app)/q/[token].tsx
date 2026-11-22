import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { countryName, flagEmoji } from '@/features/onboarding/CountryPicker';
import { followByQr, resolveQrToken } from '@/features/qr/api';
import { serverErrorKey } from '@/lib/errors';
import { publicUrl } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * Résultat d'un scan (ou d'un lien bps://q/<jeton>) : carte de profil + Suivre.
 * Follow SIMPLE : la personne scannée décide elle-même de suivre en retour.
 */
export default function QrResultScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['qrResolve', token], queryFn: () => resolveQrToken(token), retry: false });
  const follow = useMutation({
    mutationFn: () => followByQr(token),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['qrResolve', token] });
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['feed'] });
      await qc.invalidateQueries({ queryKey: ['storyTray'] });
    },
  });
  const p = query.data;

  let body: React.ReactNode;
  if (query.isPending) {
    body = <ActivityIndicator color={colors.primary} />;
  } else if (!p) {
    const key = serverErrorKey(query.error);
    body = (
      <AppText muted center>
        {key === 'errors.qr_invalid' ? t('qr.invalid') : key === 'selfie.rate_limited' ? t('errors.tooManyAttempts') : t(key)}
      </AppText>
    );
  } else {
    const status = p.i_follow;
    body = (
      <>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar uri={publicUrl(p.avatar_path)} name={p.username} size={96} />
          <AppText variant="title">@{p.username}</AppText>
          {p.display_name ? <AppText variant="bodyStrong">{p.display_name}</AppText> : null}
          {p.country_code ? (
            <AppText muted>
              {flagEmoji(p.country_code)} {countryName(p.country_code, i18n.language)}
            </AppText>
          ) : null}
          <AppText variant="caption" muted>
            {t('qr.followers', { n: p.followers_count })}
          </AppText>
          {p.bio ? <AppText center>{p.bio}</AppText> : null}
        </View>

        {p.is_me ? (
          <AppText variant="bodyStrong" center>
            {t('qr.itsYou')}
          </AppText>
        ) : status === 'active' ? (
          <AppText variant="bodyStrong" center color={colors.success}>
            {follow.isSuccess ? t('qr.followed', { username: p.username }) : t('qr.alreadyFollowing', { username: p.username })}
          </AppText>
        ) : status === 'requested' ? (
          <AppText variant="bodyStrong" center>
            {t('qr.requested', { username: p.username })}
          </AppText>
        ) : (
          <>
            <Button label={t('profile.follow')} loading={follow.isPending} onPress={() => follow.mutate()} />
            {p.is_private ? (
              <AppText variant="caption" muted center>
                {t('qr.privateHint')}
              </AppText>
            ) : null}
            {follow.isError ? (
              <AppText color={colors.danger} center>
                {t(serverErrorKey(follow.error))}
              </AppText>
            ) : null}
          </>
        )}
        {!p.is_me ? <Button variant="secondary" label={t('match.viewProfile')} onPress={() => router.replace(`/user/${p.id}`)} /> : null}
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header close title={t('qr.resultTitle')} />
      <View style={styles.content}>{body}</View>
      <View style={styles.footer}>
        <Button variant="ghost" label={t('qr.scanAnother')} onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  card: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1 },
  footer: { padding: spacing.lg },
});
