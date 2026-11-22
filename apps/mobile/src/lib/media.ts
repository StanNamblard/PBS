import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

export type Bucket = 'avatars' | 'posts' | 'stories' | 'selfies';

export interface PreparedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Redimensionne et ré-encode une photo en JPEG avant envoi.
 * Le ré-encodage supprime les métadonnées EXIF (dont la position GPS).
 */
export async function prepareImage(localUri: string, maxWidth: number): Promise<PreparedImage> {
  // maxWidth : l'image est réduite dès le décodage (jamais agrandie), ce qui
  // évite de charger en mémoire une photo de 48 Mpx.
  const context = ImageManipulator.manipulate(localUri, { maxWidth });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

function randomName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/** Envoie une photo préparée dans <bucket>/<userId>/ et renvoie son chemin. */
export async function uploadImage(bucket: Bucket, userId: string, image: PreparedImage): Promise<string> {
  const body = await (await fetch(image.uri)).arrayBuffer();
  const path = `${userId}/${randomName()}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function removeFiles(bucket: Bucket, paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths);
}

/** URL publique (avatars uniquement). */
export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

const SIGNED_TTL_SECONDS = 60 * 60; // 1 h

/**
 * URLs signées (temporaires) pour des fichiers de buckets PRIVÉS.
 * Le serveur ne les délivre que si l'utilisateur a le droit de voir le contenu.
 * Mises en cache 50 min (un peu moins que leur durée de validité).
 */
export function useSignedUrls(bucket: Exclude<Bucket, 'avatars'>, paths: string[]) {
  return useQuery({
    queryKey: ['signed', bucket, ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_TTL_SECONDS);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const item of data) {
        if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
      }
      return out;
    },
  });
}
