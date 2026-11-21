import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

import { fetchOnboardingState, isDeviceUnderage, type OnboardingState } from './api';

interface AuthContextValue {
  /** true tant que la session locale n'a pas été lue */
  initializing: boolean;
  session: Session | null;
  userId: string | null;
  /** null = pas connecté ou en cours de chargement */
  onboarding: OnboardingState | null;
  deviceUnderage: boolean;
  /** true si l'état n'a pas pu être chargé (réseau) */
  onboardingError: boolean;
  refreshOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [deviceUnderage, setDeviceUnderage] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([supabase.auth.getSession(), isDeviceUnderage()]).then(([{ data }, underage]) => {
      if (!mounted) return;
      setSession(data.session);
      setDeviceUnderage(underage);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) queryClient.clear();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const onboardingQuery = useQuery({
    queryKey: ['onboarding', userId],
    queryFn: fetchOnboardingState,
    enabled: !!userId,
    staleTime: Infinity,
  });

  const refreshOnboarding = useCallback(async () => {
    setDeviceUnderage(await isDeviceUnderage());
    await queryClient.invalidateQueries({ queryKey: ['onboarding', userId] });
  }, [queryClient, userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing: initializing || (!!userId && onboardingQuery.isPending),
      session,
      userId,
      onboarding: userId ? (onboardingQuery.data ?? null) : null,
      deviceUnderage,
      onboardingError: !!userId && onboardingQuery.isError,
      refreshOnboarding,
    }),
    [initializing, userId, onboardingQuery.isPending, onboardingQuery.isError, onboardingQuery.data, session, deviceUnderage, refreshOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
