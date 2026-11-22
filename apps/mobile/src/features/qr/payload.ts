/**
 * Contenu des QR codes BPS : « bps://q/<jeton> ».
 * (Le jour où l'app aura son nom de domaine, on passera à
 * « https://<domaine>/q/<jeton> » pour ouvrir l'app ou le store ; le lecteur
 * accepte déjà les deux formes.)
 */
export const QR_SCHEME_PREFIX = 'bps://q/';
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function buildQrPayload(token: string): string {
  return QR_SCHEME_PREFIX + token;
}

/** Extrait le jeton d'un QR code scanné, ou null si ce n'est pas un code BPS. */
export function parseQrPayload(data: string): string | null {
  const text = data.trim();
  if (TOKEN_RE.test(text)) return text;
  const match = /(?:^bps:\/\/q\/|^https?:\/\/[^/\s]+\/q\/)([A-Za-z0-9_-]{22})\/?$/.exec(text);
  return match?.[1] ?? null;
}
