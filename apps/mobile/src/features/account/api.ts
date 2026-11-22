import { supabase } from '@/lib/supabase';

export interface AccountStatus {
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  status_reason: string | null;
  status_changed_at: string | null;
  deletion_scheduled_for: string | null;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export async function getAccountStatus(): Promise<AccountStatus | null> {
  const rows = await rpc<AccountStatus[]>('get_my_account_status');
  return rows[0] ?? null;
}

/** Désactive le compte maintenant ; suppression définitive dans 30 jours. Renvoie la date. */
export const requestAccountDeletion = () => rpc<string>('request_account_deletion');
export const cancelAccountDeletion = () => rpc<void>('cancel_account_deletion');

/** Données RGPD (JSON) + liens de téléchargement (7 jours) vers MES photos. */
export async function buildExport(): Promise<string> {
  const data = await rpc<Record<string, unknown>>('export_my_data');
  const collect = (value: unknown, bucket: string, into: { bucket: string; path: string }[]) => {
    if (typeof value === 'string' && value.includes('/')) into.push({ bucket, path: value });
  };
  const files: { bucket: string; path: string }[] = [];
  const profile = data.profile as { avatar_path?: string } | null;
  collect(profile?.avatar_path, 'avatars', files);
  for (const p of (data.posts as { photos?: string[] }[]) ?? []) for (const ph of p.photos ?? []) collect(ph, 'posts', files);
  for (const s of (data.stories as { photo?: string }[]) ?? []) collect(s.photo, 'stories', files);
  for (const s of (data.selfies as { photo?: string }[]) ?? []) collect(s.photo, 'selfies', files);

  const links: Record<string, string> = {};
  for (const bucket of ['posts', 'stories', 'selfies']) {
    const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path);
    if (paths.length === 0) continue;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(paths, 7 * 24 * 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) links[`${bucket}/${s.path}`] = s.signedUrl;
  }
  for (const f of files.filter((x) => x.bucket === 'avatars')) {
    links[`avatars/${f.path}`] = supabase.storage.from('avatars').getPublicUrl(f.path).data.publicUrl;
  }
  return JSON.stringify({ ...data, photo_download_links_valid_7_days: links }, null, 2);
}
