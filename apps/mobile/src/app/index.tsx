import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { isConfigured } from '@/lib/env';

/** Redirige vers le premier écran adapté à l'état de l'utilisateur. */
export default function Index() {
  const { session, onboarding, deviceUnderage } = useAuth();

  if (!isConfigured) return <Redirect href="/setup" />;
  if (deviceUnderage || onboarding === 'underage') return <Redirect href="/underage" />;
  if (!session) return <Redirect href="/welcome" />;
  if (onboarding === 'age_required') return <Redirect href="/birthdate" />;
  if (onboarding === 'profile_required') return <Redirect href="/terms" />;
  if (onboarding === 'suspended') return <Redirect href="/suspended" />;
  if (onboarding === 'deletion_pending') return <Redirect href="/deletion-pending" />;
  return <Redirect href="/home" />;
}
