import { ageOn, isAdult, isValidEmail, isValidOtp, isValidUsername, normalizeUsername, parseBirthDate } from './validation';

const TODAY = new Date(Date.UTC(2026, 10, 22)); // 22 novembre 2026

describe('calcul de l’âge', () => {
  it('18 ans pile le jour de l’anniversaire', () => {
    expect(ageOn({ year: 2008, month: 11, day: 22 }, TODAY)).toBe(18);
    expect(isAdult({ year: 2008, month: 11, day: 22 }, TODAY)).toBe(true);
  });
  it('17 ans la veille des 18 ans', () => {
    expect(ageOn({ year: 2008, month: 11, day: 23 }, TODAY)).toBe(17);
    expect(isAdult({ year: 2008, month: 11, day: 23 }, TODAY)).toBe(false);
  });
  it('né un 29 février', () => {
    expect(isAdult({ year: 2008, month: 2, day: 29 }, TODAY)).toBe(true);
  });
});

describe('saisie de la date de naissance', () => {
  it('accepte une date valide', () => {
    expect(parseBirthDate('5', '3', '1995', TODAY)?.iso).toBe('1995-03-05');
  });
  it('refuse les dates inexistantes', () => {
    expect(parseBirthDate('31', '2', '1995', TODAY)).toBeNull();
    expect(parseBirthDate('29', '2', '2001', TODAY)).toBeNull();
    expect(parseBirthDate('0', '1', '1995', TODAY)).toBeNull();
    expect(parseBirthDate('1', '13', '1995', TODAY)).toBeNull();
  });
  it('refuse les dates futures, trop anciennes ou mal formées', () => {
    expect(parseBirthDate('1', '1', '2030', TODAY)).toBeNull();
    expect(parseBirthDate('1', '1', '1850', TODAY)).toBeNull();
    expect(parseBirthDate('aa', '1', '1995', TODAY)).toBeNull();
    expect(parseBirthDate('1', '1', '95', TODAY)).toBeNull();
  });
});

describe('pseudo', () => {
  it('normalise la saisie', () => {
    expect(normalizeUsername('  Alice 95 ')).toBe('alice95');
  });
  it.each(['alice', 'a_b.c', 'bob_1990', 'x'.repeat(30)])('accepte %s', (u) => {
    expect(isValidUsername(u)).toBe(true);
  });
  it.each(['ab', 'x'.repeat(31), '.alice', 'alice.', 'al..ice', 'Alice', 'al ice', 'alice!', 'admin', 'bps'])(
    'refuse %s',
    (u) => {
      expect(isValidUsername(u)).toBe(false);
    },
  );
});

describe('email et code', () => {
  it('valide les emails', () => {
    expect(isValidEmail('toi@exemple.com')).toBe(true);
    expect(isValidEmail('toi@exemple')).toBe(false);
    expect(isValidEmail('toi exemple.com')).toBe(false);
  });
  it('valide le code OTP de 6 à 10 chiffres', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('12345678')).toBe(true);
    expect(isValidOtp('1234567890')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('12345678901')).toBe(false);
    expect(isValidOtp('12345a')).toBe(false);
  });
});
