/**
 * Convertit les erreurs renvoyées par nos fonctions SQL (ex. "username_unavailable")
 * en clé de traduction. Les codes sont définis dans supabase/migrations.
 */
const KNOWN_CODES = [
  'username_unavailable',
  'invalid_timezone',
  'invalid_locale',
  'invalid_birth_date',
  'birth_date_already_set',
  'underage_locked',
  'onboarding_not_allowed',
  'terms_required',
  'invalid_avatar_path',
  'not_authenticated',
  'invalid_media_path',
  'invalid_media_count',
  'caption_too_long',
  'user_not_found',
  'cannot_follow_self',
  'rate_limited',
  'selfie_already_pending',
] as const;

export type ServerErrorCode = (typeof KNOWN_CODES)[number];

export function serverErrorKey(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const code = KNOWN_CODES.find((c) => message.includes(c));
  if (code === 'rate_limited' || code === 'selfie_already_pending') return `selfie.${code}`;
  return code ? `errors.${code}` : 'errors.generic';
}
