import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/features/social/ProfileView';
import { useTheme } from '@/theme/ThemeProvider';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ProfileView userId={id} />
    </SafeAreaView>
  );
}
