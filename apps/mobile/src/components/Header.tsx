import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';

interface Props {
  title?: string;
  back?: boolean;
  /** Icône de fermeture (modales) au lieu de la flèche */
  close?: boolean;
  right?: ReactNode;
}

/** Barre de titre simple avec retour. */
export function Header({ title, back = true, close, right }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {back ? (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Feather name={close ? 'x' : 'chevron-left'} size={26} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <AppText variant="subtitle" numberOfLines={1} style={styles.title}>
        {title ?? ''}
      </AppText>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  side: { width: 56 },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
