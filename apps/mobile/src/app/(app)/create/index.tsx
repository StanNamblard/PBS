import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Choix : publication ou story. */
export default function CreateScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const option = (icon: React.ComponentProps<typeof Feather>['name'], title: string, hint: string, href: '/create/post' | '/create/story') => (
    <Pressable
      onPress={() => router.replace(href)}
      style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Feather name={icon} size={28} color={colors.primary} />
      <View style={styles.flex}>
        <AppText variant="subtitle">{title}</AppText>
        <AppText muted>{hint}</AppText>
      </View>
      <Feather name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header close title={t('create.title')} />
      <View style={styles.list}>
        {option('grid', t('create.post'), t('create.postHint'), '/create/post')}
        {option('clock', t('create.story'), t('create.storyHint'), '/create/story')}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
});
