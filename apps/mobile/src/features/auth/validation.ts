/**
 * Règles de validation côté client. Elles DOUBLENT celles du serveur (qui fait
 * foi) pour donner un retour immédiat à l'utilisateur.
 * Gardées identiques à supabase/migrations/*_phase1_identity.sql.
 */

export const MIN_AGE = 18;

/** Âge révolu à la date `today` (comparaison sur année/mois/jour, sans heure). */
export function ageOn(birth: { year: number; month: number; day: number }, today: Date = new Date()): number {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const d = today.getUTCDate();
  let age = y - birth.year;
  if (m < birth.month || (m === birth.month && d < birth.day)) age -= 1;
  return age;
}

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  /** Format ISO "AAAA-MM-JJ" envoyé au serveur */
  iso: string;
}

/** Valide une saisie jour/mois/année et renvoie la date, ou null si elle n'existe pas. */
export function parseBirthDate(day: string, month: string, year: string, today: Date = new Date()): ParsedDate | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 1900 || m < 1 || m > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  const date = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (date > todayUtc) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { year: y, month: m, day: d, iso };
}

export function isAdult(birth: { year: number; month: number; day: number }, today: Date = new Date()): boolean {
  return ageOn(birth, today) >= MIN_AGE;
}

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'bps', 'official', 'team',
  'moderator', 'moderation', 'security', 'staff', 'system', 'null', 'undefined',
  'me', 'settings', 'api', 'www', 'app',
]);

/** Normalise la saisie (minuscules, sans espaces). */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '');
}

export function isValidUsername(username: string): boolean {
  return (
    /^[a-z0-9_.]{3,30}$/.test(username) &&
    !/^\.|\.$|\.\./.test(username) &&
    !RESERVED_USERNAMES.has(username)
  );
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidOtp(code: string): boolean {
  return /^\d{6}$/.test(code);
}
