import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { SmallButton } from '@/components/SmallButton';
import { listReports, reviewContent, reviewQueue, type AdminReport, type ReviewItem } from '@/features/admin/api';
import { MediaStrip } from '@/features/admin/MediaStrip';
import { notify } from '@/lib/dialogs';
import { serverErrorKey } from '@/lib/errors';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Back-office (comptes admin uniquement ; le serveur vérifie à chaque appel). */
export default function AdminScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'reports' | 'review'>('reports');
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => listReports('open') });
  const review = useQuery({ queryKey: ['admin', 'review'], queryFn: reviewQueue });
  const active = tab === 'reports' ? reports : review;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <Header title={t('admin.title')} />
      <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
        {(['reports', 'review'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.segmentItem, tab === k && { backgroundColor: colors.surface }]}>
            <AppText variant="bodyStrong" muted={tab !== k}>
              {k === 'reports' ? `${t('admin.reports')} (${reports.data?.length ?? 0})` : `${t('admin.review')} (${review.data?.length ?? 0})`}
            </AppText>
          </Pressable>
        ))}
      </View>
      {active.isError ? (
        <AppText muted center style={styles.pad}>
          {t(serverErrorKey(active.error))}
        </AppText>
      ) : tab === 'reports' ? (
        <FlatList
          data={reports.data ?? []}
          keyExtractor={(r) => r.report_id}
          refreshControl={<RefreshControl tintColor={colors.primary} refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()} />}
          renderItem={({ item }) => <ReportRow report={item} />}
          ListEmptyComponent={reports.isPending ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : <AppText muted center style={styles.pad}>{t('admin.noReports')}</AppText>}
        />
      ) : (
        <FlatList
          data={review.data ?? []}
          keyExtractor={(r) => r.kind + r.id}
          refreshControl={<RefreshControl tintColor={colors.primary} refreshing={review.isRefetching} onRefresh={() => void review.refetch()} />}
          renderItem={({ item }) => <ReviewRow item={item} />}
          ListEmptyComponent={review.isPending ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : <AppText muted center style={styles.pad}>{t('admin.noReview')}</AppText>}
        />
      )}
    </SafeAreaView>
  );
}

function ReportRow({ report }: { report: AdminReport }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/admin/report', params: { id: report.report_id } })}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <AppText variant="bodyStrong">
        @{report.target_username ?? '?'} · {t(`report.${report.reason}`)}
      </AppText>
      <AppText variant="caption" muted>
        {t('admin.context', { context: report.context })} · {timeAgo(report.created_at, t, i18n.language)} · {t('admin.openReports', { n: report.target_open_reports })}
      </AppText>
      <MediaStrip media={report.media} size={90} />
    </Pressable>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const act = async (approve: boolean) => {
    try {
      await reviewContent(item.kind, item.id, approve);
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      notify(t(serverErrorKey(e)));
    }
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="bodyStrong">
        {item.kind === 'post' ? '🖼' : '⏱'} @{item.author_username} · {item.reason ?? ''}
      </AppText>
      {item.caption ? <AppText muted numberOfLines={2}>{item.caption}</AppText> : null}
      <MediaStrip media={item.media} size={120} />
      <View style={styles.actions}>
        <SmallButton flex label={t('admin.reject')} onPress={() => void act(false)} />
        <SmallButton flex variant="primary" label={t('admin.approve')} onPress={() => void act(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.xl },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  card: { marginHorizontal: spacing.lg, marginVertical: spacing.xs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
