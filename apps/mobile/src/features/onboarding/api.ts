import * as ImageManipulator from 'expo-image-manipulator';

import { TERMS_VERSION } from '@/lib/env';
import { currentLanguage, deviceTimeZone } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error) throw error;
  return data === true;
}

/**
 * Redimensionne la photo (512 px, JPEG) puis l'envoie dans avatars/<userId>/.
 * Le ré-encodage supprime les métadonnées EXIF (dont la position GPS).
 * Renvoie le chemin de stockage.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(localUri);
  context.resize({ width: 512 });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });

  const body = await (await fetch(result.uri)).arrayBuffer();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export interface OnboardingInput {
  username: string;
  displayName: string;
  bio: string;
  countryCode: string | null;
  avatarPath: string | null;
}

export async function completeOnboarding(input: OnboardingInput) {
  const lang = currentLanguage();
  const { data, error } = await supabase.rpc('complete_onboarding', {
    p_username: input.username,
    p_display_name: input.displayName,
    p_bio: input.bio,
    p_country_code: input.countryCode ?? '',
    p_locale: lang,
    p_timezone: deviceTimeZone(),
    p_languages: [lang],
    p_terms_version: TERMS_VERSION,
    p_avatar_path: input.avatarPath,
  });
  if (error) throw error;
  return data;
}
