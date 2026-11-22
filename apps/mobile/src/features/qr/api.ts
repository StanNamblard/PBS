import * as SecureStore from 'expo-secure-store';

import { supabase } from '@/lib/supabase';

export interface QrProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  country_code: string | null;
  bio: string | null;
  is_private: boolean;
  followers_count: number;
  is_me: boolean;
  i_follow: 'active' | 'requested' | null;
  follows_me: boolean;
}

const cacheKey = (userId: string) => `bps.qrToken.${userId}`;

/** Nouveau jeton (l'ancien QR code cesse de fonctionner). Mémorisé sur le téléphone. */
export async function regenerateQrToken(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_qr_token');
  if (error) throw error;
  const token = data as string;
  try {
    await SecureStore.setItemAsync(cacheKey(userId), token);
  } catch {
    /* web : pas de stockage sécurisé, un nouveau code sera créé la prochaine fois */
  }
  return token;
}

/**
 * Mon jeton : celui mémorisé sur ce téléphone, sinon un nouveau.
 * (Le serveur ne connaît que l'empreinte du jeton : il ne peut pas le redonner.)
 */
export async function getMyQrToken(userId: string): Promise<string> {
  try {
    const cached = await SecureStore.getItemAsync(cacheKey(userId));
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  return regenerateQrToken(userId);
}

export async function resolveQrToken(token: string): Promise<QrProfile> {
  const { data, error } = await supabase.rpc('resolve_qr_token', { p_token: token });
  if (error) throw error;
  const row = (data as QrProfile[])[0];
  if (!row) throw new Error('qr_invalid');
  return row;
}

export async function followByQr(token: string): Promise<'active' | 'requested'> {
  const { data, error } = await supabase.rpc('follow_by_qr', { p_token: token });
  if (error) throw error;
  return data as 'active' | 'requested';
}
