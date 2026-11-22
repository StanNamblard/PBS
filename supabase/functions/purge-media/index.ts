// =============================================================================
// BPS — Edge Function "purge-media"
// Efface physiquement les photos qui ne doivent plus exister :
//   * selfies non appariés (expirés / annulés)
//   * selfies des matchs de plus de 24 h
//   * stories expirées (et leur ligne en base)
//   * comptes dont la suppression a été demandée il y a plus de 30 jours
//     (toutes leurs photos, puis le compte lui-même et toutes ses données)
// À appeler régulièrement (toutes les heures) par une tâche planifiée Supabase.
// Sans danger si elle est appelée plusieurs fois (idempotente).
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  // Clé "service_role" : fournie automatiquement par Supabase aux Edge Functions.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('media_to_purge', { p_limit: 500 });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Regroupe par bucket
  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as { bucket: string; path: string }[]) {
    byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.path]);
  }

  const result: Record<string, number> = {};
  for (const [bucket, paths] of byBucket) {
    // L'API de stockage accepte des lots : on découpe par 100
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error: rmError } = await supabase.storage.from(bucket).remove(chunk);
      if (rmError) return Response.json({ ok: false, bucket, error: rmError.message }, { status: 500 });
      const { error: markError } = await supabase.rpc('mark_media_purged', { p_bucket: bucket, p_paths: chunk });
      if (markError) return Response.json({ ok: false, bucket, error: markError.message }, { status: 500 });
      result[bucket] = (result[bucket] ?? 0) + chunk.length;
    }
  }

  // Comptes supprimés depuis plus de 30 jours : effacement définitif
  const { data: accounts, error: accError } = await supabase.rpc('accounts_to_delete', { p_limit: 50 });
  if (accError) return Response.json({ ok: false, error: accError.message }, { status: 500 });
  let deletedAccounts = 0;
  for (const { user_id } of (accounts ?? []) as { user_id: string }[]) {
    for (const bucket of ['avatars', 'posts', 'stories', 'selfies', 'dm']) {
      const { data: files } = await supabase.storage.from(bucket).list(user_id, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${user_id}/${f.name}`);
      for (let i = 0; i < paths.length; i += 100) {
        await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      }
    }
    // Supprimer l'utilisateur efface en cascade toutes ses données en base
    const { error: delError } = await supabase.auth.admin.deleteUser(user_id);
    if (!delError) deletedAccounts++;
  }

  return Response.json({ ok: true, purged: result, deletedAccounts });
});
