import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  flex?: boolean;
}

/** Bouton compact (listes, profils). */
export function SmallButton({ label, onPress, variant = 'secondary', loading, disabled, flex }: Props) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        flex && styles.flex,
        { backgroundColor: primary ? colors.primary : colors.surfaceAlt, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.onPrimary : colors.text} />
      ) : (
        <AppText variant="bodyStrong" color={primary ? colors.onPrimary : colors.text}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
