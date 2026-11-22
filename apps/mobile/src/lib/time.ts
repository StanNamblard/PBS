import type { TFunction } from 'i18next';

/**
 * Temps écoulé court, façon réseau social : « à l'instant », « 5 min », « 3 h »,
 * « 2 j », puis la date.
 */
export function timeAgo(iso: string, t: TFunction, locale: string, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return t('time.now');
  const min = Math.floor(diffSec / 60);
  if (min < 60) return t('time.minutes', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('time.hours', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('time.days', { n: d });
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}
