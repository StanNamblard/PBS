import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
}

export function Avatar({ uri, name, size = 96 }: Props) {
  const { colors } = useTheme();
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[shape, { backgroundColor: colors.surfaceAlt }]} contentFit="cover" transition={200} />;
  }
  return (
    <View style={[shape, styles.center, { backgroundColor: colors.surfaceAlt }]}>
      <AppText variant="title" muted>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
