import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';

/**
 * Client Supabase unique de l'app.
 * La session est persistée dans AsyncStorage (recommandation officielle Supabase
 * pour Expo : la session dépasse la taille maximale d'une entrée SecureStore).
 */
export const supabase = createClient(env.supabaseUrl || 'https://placeholder.supabase.co', env.supabaseKey || 'placeholder', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Rafraîchit le jeton uniquement quand l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
