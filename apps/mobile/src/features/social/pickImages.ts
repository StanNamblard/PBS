import * as ImagePicker from 'expo-image-picker';

/**
 * Sélection de photos pour les publications et stories.
 * (Galerie autorisée ici ; seul le selfie du jour l'interdit, en phase 3.)
 */
export async function pickFromLibrary(max: number): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    orderedSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => a.uri);
}

/** Renvoie null si l'utilisateur refuse l'accès à la caméra. */
export async function takePhoto(): Promise<string[] | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return [];
  return result.assets.map((a) => a.uri);
}
