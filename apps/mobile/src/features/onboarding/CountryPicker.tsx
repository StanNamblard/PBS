import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { COUNTRY_CODES, COUNTRY_NAMES } from '@/locales/countries.generated';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Drapeau emoji à partir du code pays ISO (ex. "FR" → 🇫🇷). */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(code: string, lang: string): string {
  return COUNTRY_NAMES[lang]?.[code] ?? COUNTRY_NAMES.en?.[code] ?? code;
}

interface Props {
  value: string | null;
  onChange: (code: string) => void;
}

export function CountryPicker({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lang = i18n.language;

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang);
    return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, lang) }))
      .filter((c) => !q || c.name.toLocaleLowerCase(lang).includes(q) || c.code.toLowerCase() === q)
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [query, lang]);

  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption" muted>
          {t('profileSetup.country')}
        </AppText>
        <Pressable
          testID="country-picker"
          onPress={() => setOpen(true)}
          style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <AppText muted={!value}>{value ? `${flagEmoji(value)}  ${countryName(value, lang)}` : t('profileSetup.chooseCountry')}</AppText>
        </Pressable>
      </View>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <TextField placeholder={t('profileSetup.searchCountry')} value={query} onChangeText={setQuery} autoFocus />
          </View>
          <FlatList
            data={items}
            keyExtractor={(i) => i.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.code);
                  setOpen(false);
                  setQuery('');
                }}
                style={[styles.item, { borderBottomColor: colors.border }]}
              >
                <AppText>
                  {flagEmoji(item.code)}  {item.name}
                </AppText>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center' },
  header: { padding: spacing.md },
  item: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
