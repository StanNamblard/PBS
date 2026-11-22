import { timeAgo } from './time';

const t = ((key: string, opts?: { n: number }) => (opts ? `${key}:${opts.n}` : key)) as never;
const NOW = new Date('2026-11-23T12:00:00Z');

describe('timeAgo', () => {
  it.each([
    ['2026-11-23T11:59:30Z', 'time.now'],
    ['2026-11-23T11:55:00Z', 'time.minutes:5'],
    ['2026-11-23T09:00:00Z', 'time.hours:3'],
    ['2026-11-21T12:00:00Z', 'time.days:2'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, t, 'fr', NOW)).toBe(expected);
  });
  it('affiche la date au-delà de 7 jours', () => {
    expect(timeAgo('2026-11-01T12:00:00Z', t, 'en', NOW)).toMatch(/Nov/);
  });
});
