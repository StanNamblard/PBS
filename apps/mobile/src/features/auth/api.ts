import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type OnboardingState = 'underage' | 'age_required' | 'profile_required' | 'suspended' | 'complete';

/** Envoie un code de connexion (6 à 10 chiffres selon le réglage Supabase) par email (crée le compte si besoin). */
export async function sendEmailOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
  if (error) throw error;
}

/** Sign in with Apple (iOS uniquement). Nécessite un build de développement ou TestFlight. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  // Dans Expo Go, le jeton Apple est émis pour l'app Expo Go et non pour BPS :
  // Supabase le refuserait. Le bouton n'apparaît donc que dans un vrai build.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple() {
  // Le "nonce" protège contre le rejeu du jeton Apple : on envoie son hash à Apple
  // et la valeur brute à Supabase, qui vérifie la correspondance.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('apple_no_token');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc('get_onboarding_state');
  if (error) throw error;
  return data as OnboardingState;
}

/** Contrôle d'âge côté serveur. Renvoie false si l'utilisateur est mineur. */
export async function verifyAge(isoBirthDate: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_age', { p_birth_date: isoBirthDate });
  if (error) throw error;
  if (data === false) await markDeviceUnderage();
  return data === true;
}

// ---------------------------------------------------------------------------
// Verrou « mineur » sur l'appareil : après un refus d'âge, l'app reste bloquée
// sur ce téléphone, même avec une autre adresse email.
// ---------------------------------------------------------------------------
const UNDERAGE_KEY = 'bps.underageLock';

export async function markDeviceUnderage() {
  try {
    await SecureStore.setItemAsync(UNDERAGE_KEY, '1');
  } catch {
    /* SecureStore indisponible (web) : le verrou serveur reste actif */
  }
}

export async function isDeviceUnderage(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(UNDERAGE_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Mode développement uniquement : retire le verrou « mineur » de l'appareil de test. */
export async function clearDeviceUnderageForTesting() {
  if (!__DEV__) return;
  try {
    await SecureStore.deleteItemAsync(UNDERAGE_KEY);
  } catch {
    /* ignore */
  }
}
