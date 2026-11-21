import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  onPress: () => void;
  size?: number;
  accessibilityLabel: string;
}

/**
 * LE bouton de l'app : rond, dégradé « flash », entouré d'un anneau qui respire.
 * Volontairement l'élément le plus visible de l'interface.
 */
export function SelfieButton({ onPress, size = 76, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.35 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={{ width: size, height: size }}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: 3, borderColor: colors.primary }, ringStyle]}
      />
      <LinearGradient
        colors={[colors.primary, colors.primaryAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, { borderRadius: size / 2 }]}
      >
        <View style={[styles.lens, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lens: { borderWidth: 4, borderColor: '#FFFFFF' },
});
