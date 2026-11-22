import { TERMS_VERSION } from '@/lib/env';
import { currentLanguage, deviceTimeZone } from '@/lib/i18n';
import { prepareImage, publicUrl, uploadImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error) throw error;
  return data === true;
}

/** Envoie la photo de profil (512 px, sans métadonnées) dans avatars/<userId>/. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const image = await prepareImage(localUri, 512);
  return uploadImage('avatars', userId, image);
}

export function avatarUrl(path: string | null | undefined): string | null {
  return publicUrl(path);
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
