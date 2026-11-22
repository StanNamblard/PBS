import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileView } from '@/features/social/ProfileView';
import { useTheme } from '@/theme/ThemeProvider';

export default function MyProfileScreen() {
  const { userId } = useAuth();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {userId ? <ProfileView userId={userId} isTab /> : null}
    </SafeAreaView>
  );
}
