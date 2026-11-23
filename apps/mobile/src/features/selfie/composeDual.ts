/**
 * Mode Double — iPhone / Android : l'assemblage est fait en « photographiant »
 * la vue d'aperçu (react-native-view-shot, voir l'écran caméra).
 * Ce fichier n'est utilisé que pour avoir la même signature que la version web
 * (composeDual.web.ts) : sur mobile, la caméra n'appelle pas cette fonction.
 */
export async function composeDual(_mainUri: string, _insetUri: string): Promise<string> {
  throw new Error('composeDual_web_only');
}
