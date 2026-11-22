import { fnv1a, localYmd, regionForOffset, regionWave, upcomingWaves, userWave } from './waves';

const DAY = { y: 2026, m: 11, d: 24 };

describe('régions', () => {
  it.each([
    [-600, 'americas'], // Hawaï
    [-300, 'americas'], // New York
    [-180, 'americas'], // São Paulo
    [0, 'emea'], // Londres
    [60, 'emea'], // Paris
    [180, 'emea'], // Moscou
    [330, 'apac'], // Inde
    [540, 'apac'], // Tokyo
  ])('décalage %i min → %s', (offset, region) => {
    expect(regionForOffset(offset)).toBe(region);
  });
});

describe('vague d’une région', () => {
  it('est déterministe (même résultat sur tous les téléphones)', () => {
    expect(regionWave(DAY, 'emea').toISOString()).toBe(regionWave(DAY, 'emea').toISOString());
    expect(fnv1a('2026-11-24:emea')).toBe(fnv1a('2026-11-24:emea'));
  });
  it('tombe entre 11 h 30 et 20 h 30 à l’heure de référence, sur 60 jours', () => {
    for (let i = 0; i < 60; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i));
      const ymd = { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
      const wave = regionWave(ymd, 'emea');
      const parisMinutes = ((wave.getUTCHours() + 1) % 24) * 60 + wave.getUTCMinutes();
      expect(parisMinutes).toBeGreaterThanOrEqual(11 * 60 + 30);
      expect(parisMinutes).toBeLessThan(20 * 60 + 30);
    }
  });
  it('change d’un jour à l’autre', () => {
    const a = regionWave(DAY, 'emea');
    const b = regionWave({ ...DAY, d: 25 }, 'emea');
    expect(b.getTime() - a.getTime()).not.toBe(24 * 3600 * 1000);
  });
});

describe('vague d’un utilisateur', () => {
  it('Paris et Berlin (même région) reçoivent la vague au même instant', () => {
    expect(userWave(DAY, 60).getTime()).toBe(userWave(DAY, 60).getTime());
    expect(userWave(DAY, 60).getTime()).toBe(regionWave(DAY, 'emea').getTime());
  });
  it('heure locale toujours entre 9 h et 22 h, partout dans le monde', () => {
    for (const offset of [-600, -480, -300, -180, 0, 60, 120, 180, 210, 330, 480, 540, 600, 780]) {
      for (let i = 0; i < 30; i++) {
        const date = new Date(Date.UTC(2026, 5, 1 + i));
        const ymd = { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
        const wave = userWave(ymd, offset);
        const localHour = new Date(wave.getTime() + offset * 60_000).getUTCHours();
        expect(localHour).toBeGreaterThanOrEqual(9);
        expect(localHour).toBeLessThan(22);
        expect(localYmd(wave, offset)).toEqual(ymd);
      }
    }
  });
});

describe('prochaines vagues', () => {
  it('renvoie 7 rappels futurs, un par jour', () => {
    const now = new Date('2026-11-24T05:00:00Z');
    const waves = upcomingWaves(now, 60, 7);
    expect(waves).toHaveLength(7);
    waves.forEach((w) => expect(w.getTime()).toBeGreaterThan(now.getTime()));
    const days = new Set(waves.map((w) => localYmd(w, 60).d));
    expect(days.size).toBe(7);
  });
  it('saute la vague du jour si elle est déjà passée', () => {
    const now = new Date('2026-11-24T22:30:00Z');
    const waves = upcomingWaves(now, 60, 3);
    expect(localYmd(waves[0]!, 60).d).toBe(25);
  });
});
