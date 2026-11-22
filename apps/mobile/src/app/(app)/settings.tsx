import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { amIAdmin } from '@/features/admin/api';
import { signOut } from '@/features/auth/api';
import { ensureNotificationPermission, isReminderEnabled, setReminderEnabled } from '@/features/selfie/reminders';
import { notify } from '@/lib/dialogs';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { updateMyProfile } from '@/features/social/api';
import { TextField } from '@/components/TextField';
import { setAppLanguage, SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const { userId } = useAuth();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const [privateSaving, setPrivateSaving] = useState(false);
  const [reminder, setReminder] = useState(true);
  const { data: isAdmin } = useQuery({ queryKey: ['amIAdmin'], queryFn: amIAdmin });

  useEffect(() => {
    void isReminderEnabled().then(setReminder);
  }, []);

  const toggleReminder = async (value: boolean) => {
    setReminder(value);
    if (value && !(await ensureNotificationPermission())) {
      setReminder(false);
      notify(t('selfie.notificationsBlocked'));
      return;
    }
    await setReminderEnabled(value);
  };

  const togglePrivate = async (value: boolean) => {
    if (!userId) return;
    setPrivateSaving(true);
    try {
      await updateMyProfile(userId, { is_private: value });
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['followRequests'] });
    } finally {
      setPrivateSaving(false);
    }
  };

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

      <Section title={t('settings.privacy')}>
        <View style={styles.switchRow}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {t('settings.privateAccount')}
          </AppText>
          <Switch
            value={!!profile?.is_private}
            disabled={!profile || privateSaving}
            onValueChange={(v) => void togglePrivate(v)}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <AppText variant="caption" muted>
          {t('settings.privateAccountHint')}
        </AppText>
      </Section>

      <Section title={t('settings.notifications')}>
        <View style={styles.switchRow}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {t('selfie.dailyReminder')}
          </AppText>
          <Switch value={reminder} onValueChange={(v) => void toggleReminder(v)} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        <AppText variant="caption" muted>
          {t('selfie.dailyReminderHint')}
        </AppText>
      </Section>

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
        <Button variant="secondary" label={t('settings.blockedAccounts')} onPress={() => router.push('/blocked')} />
        <Button variant="secondary" label={t('settings.exportData')} onPress={() => router.push('/account/export')} />
        <Button variant="secondary" label={t('settings.deleteAccount')} onPress={() => router.push('/account/delete')} />
        <Button variant="danger" label={t('common.signOut')} onPress={() => void signOut()} />
      </Section>

      {isAdmin ? (
        <Section title={t('admin.title')}>
          <Button label={t('admin.entry')} onPress={() => router.push('/admin')} />
        </Section>
      ) : null}

      {__DEV__ && userId ? <DevTools userId={userId} /> : null}

      <AppText variant="caption" muted center>
        {t('settings.version', { v: Constants.expoConfig?.version ?? '?' })}
      </AppText>
      <View style={{ height: spacing.md, backgroundColor: colors.background }} />
    </Screen>
  );
}

/**
 * Outils de test, visibles uniquement en développement (jamais dans l'app
 * publiée) : tant que le selfie du jour et le QR code n'existent pas, c'est le
 * seul moyen d'ouvrir le profil d'un ami pour le suivre.
 */
function DevTools({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [target, setTarget] = useState('');
  const valid = /^[0-9a-f-]{36}$/i.test(target.trim());
  return (
    <Section title={t('settings.devTools')}>
      <AppText variant="caption" muted>
        {t('settings.myId')}
      </AppText>
      <AppText selectable>{userId}</AppText>
      <Button
        variant="secondary"
        label={copied ? t('settings.copied') : t('settings.copy')}
        onPress={async () => {
          await Clipboard.setStringAsync(userId);
          setCopied(true);
        }}
      />
      <TextField
        label={t('settings.openProfile')}
        value={target}
        onChangeText={setTarget}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      />
      <Button variant="secondary" label={t('settings.open')} disabled={!valid} onPress={() => router.push(`/user/${target.trim()}`)} />
    </Section>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
