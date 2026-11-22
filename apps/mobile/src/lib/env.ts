/**
 * Variables d'environnement publiques (préfixe EXPO_PUBLIC_, intégrées au build).
 * Ne JAMAIS mettre de clé secrète ici : seule la clé "publishable/anon" de
 * Supabase est publique, la sécurité repose sur les règles RLS côté serveur.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
};

export const isConfigured = env.supabaseUrl.startsWith('https://') && env.supabaseKey.length > 10;

/** Version des CGU / politique de confidentialité acceptée à l'inscription. */
export { LEGAL_VERSION as TERMS_VERSION } from '@/legal/fr';
