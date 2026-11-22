import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField, type TextFieldRef } from '@/components/TextField';
import { signOut, verifyAge } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { parseBirthDate } from '@/features/auth/validation';
import { dateFieldOrder, type DatePart } from '@/features/onboarding/dateOrder';
import { serverErrorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { confirm } from '@/lib/dialogs';

/**
 * Contrôle d'âge « neutre » (recommandation Apple/Google) : aucun champ pré-rempli
 * avec une date majeure, aucune indication de l'âge minimum avant la saisie.
 * La décision finale est prise par le serveur (verify_age).
 */
export default function BirthdateScreen() {
  const { t, i18n } = useTranslation();
  const { refreshOnboarding } = useAuth();
  const { colors } = useTheme();
  const [values, setValues] = useState<Record<DatePart, string>>({ day: '', month: '', year: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = { day: useRef<TextFieldRef>(null), month: useRef<TextFieldRef>(null), year: useRef<TextFieldRef>(null) };
  const order = dateFieldOrder(i18n.language);

  const parsed = parseBirthDate(values.day, values.month, values.year);

  const setPart = (part: DatePart, v: string) => {
    const max = part === 'year' ? 4 : 2;
    const digits = v.replace(/\D/g, '').slice(0, max);
    setValues((prev) => ({ ...prev, [part]: digits }));
    setError(null);
    const idx = order.indexOf(part);
    const next = order[idx + 1];
    if (digits.length === max && next) refs[next].current?.focus();
  };

  const submit = () => {
    if (!parsed) {
      setError(t('birthdate.invalid'));
      return;
    }
    const formatted = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)),
    );
    void confirm({
      title: t('birthdate.confirmTitle'),
      message: t('birthdate.confirmBody', { date: formatted }),
      confirmText: t('common.continue'),
      cancelText: t('common.cancel'),
    }).then((ok) => {
      if (ok) void send(parsed.iso);
    });
  };

  const send = async (iso: string) => {
    setLoading(true);
    try {
      const adult = await verifyAge(iso);
      await refreshOnboarding();
      router.replace(adult ? '/terms' : '/underage');
    } catch (e) {
      setError(t(serverErrorKey(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button testID="birthdate-continue" label={t('common.continue')} onPress={submit} loading={loading} disabled={!parsed} />
          <Button variant="ghost" label={t('common.signOut')} onPress={() => void signOut()} />
        </>
      }
    >
      <AppText variant="title">{t('birthdate.title')}</AppText>
      <AppText muted>{t('birthdate.subtitle')}</AppText>
      <View style={styles.row}>
        {order.map((part) => (
          <View key={part} style={part === 'year' ? styles.year : styles.small}>
            <TextField
              ref={refs[part]}
              testID={`birthdate-${part}`}
              placeholder={t(`birthdate.${part}`)}
              value={values[part]}
              onChangeText={(v) => setPart(part, v)}
              keyboardType="number-pad"
              maxLength={part === 'year' ? 4 : 2}
              style={styles.center}
            />
          </View>
        ))}
      </View>
      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  small: { flex: 1 },
  year: { flex: 1.6 },
  center: { textAlign: 'center' },
});
