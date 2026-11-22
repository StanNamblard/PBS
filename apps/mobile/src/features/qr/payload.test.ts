import { buildQrPayload, parseQrPayload } from './payload';

const TOKEN = 'AbCdEfGhIjKlMnOpQr_-12';

describe('QR code BPS', () => {
  it('aller-retour : le code généré est relu à l’identique', () => {
    expect(parseQrPayload(buildQrPayload(TOKEN))).toBe(TOKEN);
  });
  it.each([
    [`bps://q/${TOKEN}`, TOKEN],
    [`https://bps.example/q/${TOKEN}`, TOKEN],
    [`https://bps.example/q/${TOKEN}/`, TOKEN],
    [TOKEN, TOKEN],
    [`  bps://q/${TOKEN}\n`, TOKEN],
  ])('accepte %s', (input, expected) => {
    expect(parseQrPayload(input)).toBe(expected);
  });
  it.each([
    'https://example.com',
    'bps://q/trop-court',
    `bps://q/${TOKEN}x`,
    `bps://user/${TOKEN}`,
    `javascript:alert(1)//q/${TOKEN}`,
    'WIFI:S:maison;T:WPA;P:secret;;',
  ])('refuse %s', (input) => {
    expect(parseQrPayload(input)).toBeNull();
  });
});
