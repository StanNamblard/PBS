import en from './en.json';
import fr from './fr.json';

/** Liste toutes les clés "a.b.c" d'un fichier de traduction. */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('traductions', () => {
  it('le français et l’anglais ont exactement les mêmes clés', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });
});
