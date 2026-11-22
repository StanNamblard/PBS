import { supabase } from '@/lib/supabase';

export interface MediaRef {
  bucket: 'posts' | 'stories' | 'selfies' | 'avatars';
  path: string;
}

export interface AdminReport {
  report_id: string;
  created_at: string;
  reason: string;
  details: string | null;
  context: 'selfie' | 'profile' | 'post' | 'story' | 'message';
  context_id: string | null;
  status: string;
  reporter_username: string | null;
  target_id: string | null;
  target_username: string | null;
  target_avatar_path: string | null;
  target_status: 'active' | 'suspended' | 'banned' | 'deleted' | null;
  target_open_reports: number;
  media: MediaRef[];
}

export interface ReviewItem {
  kind: 'post' | 'story';
  id: string;
  author_id: string;
  author_username: string;
  created_at: string;
  caption: string | null;
  media: MediaRef[];
  reason: string | null;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const amIAdmin = () => rpc<boolean>('am_i_admin');
export const listReports = (status: 'open' | 'all' = 'open') => rpc<AdminReport[]>('admin_list_reports', { p_status: status });
export const resolveReport = (reportId: string, action: 'dismiss' | 'remove_content' | 'suspend' | 'ban', note: string | null) =>
  rpc<void>('admin_resolve_report', { p_report: reportId, p_action: action, p_note: note });
export const setUserStatus = (userId: string, status: 'active' | 'suspended' | 'banned', reason: string | null) =>
  rpc<void>('admin_set_user_status', { p_user: userId, p_status: status, p_reason: reason });
export const reviewQueue = () => rpc<ReviewItem[]>('admin_review_queue');
export const reviewContent = (kind: 'post' | 'story', id: string, approve: boolean) =>
  rpc<void>('admin_review_content', { p_kind: kind, p_id: id, p_approve: approve });
