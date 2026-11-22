import { useQuery } from '@tanstack/react-query';

import { getMatch, getPendingSelfie, getRecentMatches } from './api';

export const selfieKeys = {
  pending: ['selfie', 'pending'] as const,
  recent: ['selfie', 'recent'] as const,
  match: (id: string) => ['selfie', 'match', id] as const,
};

export const usePendingSelfie = () => useQuery({ queryKey: selfieKeys.pending, queryFn: getPendingSelfie });
export const useRecentMatches = () => useQuery({ queryKey: selfieKeys.recent, queryFn: getRecentMatches });
export const useMatch = (id: string) => useQuery({ queryKey: selfieKeys.match(id), queryFn: () => getMatch(id) });

export function formatTime(iso: string | Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
