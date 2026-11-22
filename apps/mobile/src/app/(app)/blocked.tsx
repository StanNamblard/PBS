import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { SmallButton } from '@/components/SmallButton';
import { UserRow } from '@/components/UserRow';
import { getBlockedUsers, unblockUser } from '@/features/messages/api';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Paramètres → Comptes bloqués. */
export default function BlockedScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({ queryKey: ['blocked'], queryFn: getBlockedUsers });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={t('settings.blockedAccounts')} />
      <FlatList
        data={data}
        keyExtractor={(u) => u.id}
        ListEmptyComponent={
          isPending ? undefined : (
            <AppText muted center style={{ padding: spacing.xl }}>
              {t('settings.noBlocked')}
            </AppText>
          )
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            right={
              <SmallButton
                label={t('settings.unblock')}
                onPress={async () => {
                  await unblockUser(item.id);
                  await qc.invalidateQueries();
                }}
              />
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
