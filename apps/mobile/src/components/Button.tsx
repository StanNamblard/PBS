import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style, testID }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const handlePress = () => {
    if (inactive) return;
    void Haptics.selectionAsync();
    onPress();
  };

  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.onPrimary : variant === 'ghost' ? colors.text : colors.text;

  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={textColor} /> : icon}
      <AppText variant="button" color={textColor}>
        {label}
      </AppText>
    </View>
  );

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={handlePress}
      style={({ pressed }) => [{ opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[colors.primary, colors.primaryAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.base}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            variant === 'secondary' && { backgroundColor: colors.surfaceAlt },
            variant === 'danger' && { backgroundColor: colors.danger },
            variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
