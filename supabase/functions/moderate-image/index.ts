// =============================================================================
// BPS — Edge Function "moderate-image"
// Analyse une photo que l'utilisateur vient d'envoyer, AVANT qu'elle ne soit
// utilisée (publication, story, selfie, message, photo de profil).
//
// Appel (depuis l'app, avec la session de l'utilisateur) :
//   POST { "bucket": "posts", "path": "<user id>/<fichier>.jpg" }
// Réponse : { "decision": "approved" | "review" | "rejected", "reason": "..." }
//
// Déploiement : désactiver « Verify JWT » dans Supabase. La fonction vérifie
// elle-même la session (auth.getUser), ce qui marche avec les nouvelles clés
// de signature Supabase, contrairement à la vérification automatique.
//
// Le verdict est enregistré dans la table moderation_results ; la base de
// données refuse ensuite toute photo non approuvée (voir migrations phase 6).
// Si les clés Sightengine ne sont pas configurées, la photo est approuvée
// (provider "none") pour ne pas bloquer l'app avant la configuration.
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKETS = new Set(['avatars', 'posts', 'stories', 'selfies', 'dm']);
// Pour ces usages, une photo « douteuse » est refusée (pas de file d'attente possible)
const STRICT_BUCKETS = new Set(['avatars', 'selfies', 'dm']);

type Decision = 'approved' | 'review' | 'rejected';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Règles de décision à partir de la réponse Sightengine (lecture défensive). */
function decide(result: Record<string, any>, bucket: string): { decision: Decision; reason: string } {
  const nudity = result.nudity ?? {};
  const sexual = Math.max(num(nudity.sexual_activity), num(nudity.sexual_display));
  const erotica = num(nudity.erotica);
  const verySuggestive = num(nudity.very_suggestive);
  const gore = num(result.gore?.prob);
  const offensive = Math.max(0, ...Object.values(result.offensive ?? {}).map(num));

  if (sexual >= 0.6) return { decision: 'rejected', reason: 'nudity' };
  if (erotica >= 0.8) return { decision: 'rejected', reason: 'nudity' };
  if (gore >= 0.8) return { decision: 'rejected', reason: 'gore' };

  if (erotica >= 0.5 || verySuggestive >= 0.8) return { decision: 'review', reason: 'suggestive' };
  if (gore >= 0.5) return { decision: 'review', reason: 'gore' };
  if (offensive >= 0.6) return { decision: 'review', reason: 'offensive' };
  return { decision: 'approved', reason: 'ok' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // 1. Qui appelle ? (session de l'utilisateur)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: 'not_authenticated' }, 401);
    const userId = userData.user.id;

    // 2. Quelle photo ? Elle doit être dans SON dossier
    const { bucket, path } = (await req.json()) as { bucket?: string; path?: string };
    if (!bucket || !BUCKETS.has(bucket) || !path || !path.startsWith(`${userId}/`)) {
      return json({ error: 'invalid_media_path' }, 400);
    }

    // 3. Analyse
    const apiUser = Deno.env.get('SIGHTENGINE_API_USER');
    const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET');
    let decision: Decision = 'approved';
    let reason = 'moderation_not_configured';
    let provider = 'none';
    let scores: unknown = null;

    if (apiUser && apiSecret) {
      const { data: file, error: dlError } = await admin.storage.from(bucket).download(path);
      if (dlError || !file) return json({ error: 'file_not_found' }, 404);

      const form = new FormData();
      form.append('media', file, 'photo.jpg');
      // Pas de détection de visage : montrer son visage n'est PAS obligatoire
      // (caméra arrière, mode double, personnes qui ne souhaitent pas se montrer…)
      form.append('models', 'nudity-2.1,gore-2.0,offensive-2.0');
      form.append('api_user', apiUser);
      form.append('api_secret', apiSecret);
      const res = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form });
      const result = await res.json();
      if (result.status !== 'success') {
        // En cas de panne du service : revue manuelle (publications) ou refus (selfies, messages…)
        decision = STRICT_BUCKETS.has(bucket) ? 'rejected' : 'review';
        reason = 'moderation_unavailable';
      } else {
        ({ decision, reason } = decide(result, bucket));
        if (decision === 'review' && STRICT_BUCKETS.has(bucket)) decision = 'rejected';
      }
      provider = 'sightengine';
      scores = { nudity: result.nudity, gore: result.gore, offensive: result.offensive };
    }

    // 4. Enregistre le verdict (la base de données s'en sert pour autoriser ou non la photo)
    const { error: saveError } = await admin
      .from('moderation_results')
      .upsert({ bucket, path, user_id: userId, decision, reason, provider, scores });
    if (saveError) return json({ error: saveError.message }, 500);

    // 5. Une photo refusée est effacée tout de suite
    if (decision === 'rejected') await admin.storage.from(bucket).remove([path]);

    return json({ decision, reason });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
