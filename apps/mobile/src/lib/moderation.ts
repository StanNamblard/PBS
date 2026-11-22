import { supabase } from './supabase';
import type { Bucket } from './media';

export type ModerationDecision = 'approved' | 'review' | 'rejected';

/**
 * Fait analyser une photo qui vient d'être envoyée (fonction serveur
 * « moderate-image », service Sightengine).
 * - rejected → lève une erreur « content_rejected » (ou « no_face » pour un selfie sans visage)
 * - review   → la photo pourra être publiée mais restera « en attente de revue »
 * Si la fonction n'est pas encore installée sur le serveur, on laisse passer :
 * c'est la base de données qui décide (interrupteur « moderation_enforced »).
 */
export async function moderateUpload(bucket: Bucket, path: string): Promise<ModerationDecision> {
  const { data, error } = await supabase.functions.invoke<{ decision?: ModerationDecision; reason?: string }>('moderate-image', {
    body: { bucket, path },
  });
  if (error || !data?.decision) return 'approved';
  if (data.decision === 'rejected') {
    throw new Error(data.reason === 'no_face' ? 'no_face' : 'content_rejected');
  }
  return data.decision;
}
