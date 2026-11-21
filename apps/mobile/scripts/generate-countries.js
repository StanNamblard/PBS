/**
 * Génère src/locales/countries.generated.ts : la liste des pays (ISO 3166-1)
 * et leur nom dans chacune des langues de l'app, grâce aux données ICU de Node.
 * Usage : node scripts/generate-countries.js
 */
const fs = require('fs');
const path = require('path');

const CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT
MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG
UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/);

const LOCALES = ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur'];
const names = {};
for (const locale of LOCALES) {
  const dn = new Intl.DisplayNames([locale], { type: 'region' });
  names[locale] = Object.fromEntries(CODES.map((c) => [c, dn.of(c)]));
}

const out = `// FICHIER GÉNÉRÉ par scripts/generate-countries.js — ne pas modifier à la main.
export const COUNTRY_CODES = ${JSON.stringify(CODES)} as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];
export const COUNTRY_NAMES: Record<string, Record<string, string>> = ${JSON.stringify(names)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'locales', 'countries.generated.ts'), out);
console.log(`${CODES.length} pays × ${LOCALES.length} langues générés`);
