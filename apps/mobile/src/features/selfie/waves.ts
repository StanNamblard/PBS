/**
 * « Vagues » quotidiennes du selfie du jour.
 *
 * Chaque jour, pour chacune des 3 grandes régions, un horaire est tiré au hasard
 * (mais de façon DÉTERMINISTE : tous les téléphones calculent le même) entre
 * 11 h 30 et 20 h 30 à l'heure de référence de la région. Tout le monde d'une
 * région est donc invité au même instant → la file d'attente se remplit d'un coup.
 *
 * Si l'horaire tombe en dehors de 9 h–22 h pour l'utilisateur (fuseaux extrêmes,
 * ex. Hawaï), on se rabat sur 19 h à son heure locale.
 */

export type Region = 'americas' | 'emea' | 'apac';

/** Décalage UTC (en heures) de l'heure de référence de chaque région (hors heure d'été). */
const REFERENCE_OFFSET_HOURS: Record<Region, number> = {
  americas: -5, // New York
  emea: 1, // Paris
  apac: 8, // Singapour / Shanghai
};

const WINDOW_START_MIN = 11 * 60 + 30; // 11:30
const WINDOW_LENGTH_MIN = 9 * 60; // → jusqu'à 20:29
const USER_MIN_HOUR = 9;
const USER_MAX_HOUR = 22;
const FALLBACK_HOUR = 19;

/** Région d'après le décalage du fuseau de l'utilisateur, en minutes à l'est d'UTC. */
export function regionForOffset(offsetMinutes: number): Region {
  if (offsetMinutes <= -150) return 'americas'; // UTC-2:30 et moins
  if (offsetMinutes >= 300) return 'apac'; // UTC+5 et plus
  return 'emea';
}

/** Hachage FNV-1a 32 bits (stable et identique sur tous les appareils). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number;
}

function ymdKey({ y, m, d }: YMD): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Instant (UTC) de la vague d'une région pour une date donnée. */
export function regionWave(date: YMD, region: Region): Date {
  const minutes = WINDOW_START_MIN + (fnv1a(`${ymdKey(date)}:${region}`) % WINDOW_LENGTH_MIN);
  const offsetMin = REFERENCE_OFFSET_HOURS[region] * 60;
  return new Date(Date.UTC(date.y, date.m - 1, date.d, 0, 0) + (minutes - offsetMin) * 60_000);
}

/** Date locale (année/mois/jour) de l'utilisateur à un instant donné. */
export function localYmd(instant: Date, offsetMinutes: number): YMD {
  const shifted = new Date(instant.getTime() + offsetMinutes * 60_000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/** Instant de la vague pour CET utilisateur et ce jour local (avec repli 19 h). */
export function userWave(date: YMD, offsetMinutes: number): Date {
  const wave = regionWave(date, regionForOffset(offsetMinutes));
  const localHour = new Date(wave.getTime() + offsetMinutes * 60_000).getUTCHours();
  const waveLocalDay = localYmd(wave, offsetMinutes);
  const sameDay = ymdKey(waveLocalDay) === ymdKey(date);
  if (sameDay && localHour >= USER_MIN_HOUR && localHour < USER_MAX_HOUR) return wave;
  return new Date(Date.UTC(date.y, date.m - 1, date.d, FALLBACK_HOUR, 0) - offsetMinutes * 60_000);
}

/** Prochaines vagues (à venir uniquement), pour programmer les rappels. */
export function upcomingWaves(now: Date, offsetMinutes: number, days = 7): Date[] {
  const today = localYmd(now, offsetMinutes);
  const out: Date[] = [];
  for (let k = 0; out.length < days && k < days + 1; k++) {
    const base = new Date(Date.UTC(today.y, today.m - 1, today.d + k, 12));
    const wave = userWave({ y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() }, offsetMinutes);
    if (wave.getTime() > now.getTime()) out.push(wave);
  }
  return out;
}

/** Décalage du fuseau du téléphone, en minutes à l'est d'UTC (heure d'été comprise). */
export function deviceOffsetMinutes(at: Date = new Date()): number {
  return -at.getTimezoneOffset();
}
