import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { SmallButton } from '@/components/SmallButton';
import { UserRow } from '@/components/UserRow';
import { useFollowActions, useFollowRequests } from '@/features/social/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function FollowRequestsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data = [], isPending } = useFollowRequests();
  const { respond } = useFollowActions();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={t('requests.title')} />
      <FlatList
        data={data}
        keyExtractor={(u) => u.id}
        ListEmptyComponent={
          isPending ? undefined : (
            <AppText muted center style={{ padding: spacing.xl }}>
              {t('requests.empty')}
            </AppText>
          )
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            right={
              <View style={styles.actions}>
                <SmallButton variant="primary" label={t('requests.accept')} onPress={() => respond.mutate({ userId: item.id, accept: true })} />
                <SmallButton label={t('requests.decline')} onPress={() => respond.mutate({ userId: item.id, accept: false })} />
              </View>
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: spacing.sm } });
