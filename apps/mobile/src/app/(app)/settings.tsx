import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { signOut } from '@/features/auth/api';
import { setAppLanguage, SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();

  const changeLanguage = async (code: LanguageCode) => {
    await setAppLanguage(code);
    // Mémorise aussi la langue côté serveur (pour les notifications, phase 3)
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from('user_private').update({ locale: code }).eq('user_id', data.user.id);
  };

  const themes: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: t('settings.themeSystem') },
    { key: 'light', label: t('settings.themeLight') },
    { key: 'dark', label: t('settings.themeDark') },
  ];

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);

  return (
    <Screen scroll footer={<Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />}>
      <AppText variant="title">{t('settings.title')}</AppText>

      <Section title={t('settings.appearance')}>
        <View style={styles.chips}>
          {themes.map((th) => (
            <Chip key={th.key} label={th.label} selected={preference === th.key} onPress={() => setPreference(th.key)} />
          ))}
        </View>
      </Section>

      <Section title={t('settings.language')}>
        <View style={styles.chips}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.nativeName} selected={i18n.language === l.code} onPress={() => void changeLanguage(l.code)} />
          ))}
        </View>
        {current && !current.translated ? (
          <AppText variant="caption" muted>
            {t('settings.languageNotTranslated')}
          </AppText>
        ) : null}
      </Section>

      <Section title={t('settings.legal')}>
        <Button variant="secondary" label={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <Button variant="secondary" label={t('settings.privacy')} onPress={() => router.push('/legal/privacy')} />
      </Section>

      <Section title={t('settings.account')}>
        <Button variant="secondary" label={`${t('settings.exportData')} · ${t('common.phase', { n: 6 })}`} disabled onPress={() => {}} />
        <Button variant="secondary" label={`${t('settings.deleteAccount')} · ${t('common.phase', { n: 6 })}`} disabled onPress={() => {}} />
        <Button variant="danger" label={t('common.signOut')} onPress={() => void signOut()} />
      </Section>

      <AppText variant="caption" muted center>
        {t('settings.version', { v: Constants.expoConfig?.version ?? '?' })}
      </AppText>
      <View style={{ height: spacing.md, backgroundColor: colors.background }} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="subtitle">{title}</AppText>
      {children}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface },
      ]}
    >
      <AppText variant="bodyStrong" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
