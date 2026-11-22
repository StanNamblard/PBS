import * as Crypto from 'expo-crypto';

import { prepareImage, uploadImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

export type SubmissionStatus = 'pending' | 'matched' | 'expired' | 'cancelled';
export type MatchDecision = 'pending' | 'follow' | 'pass';
export type ReportReason = 'nudity' | 'minor' | 'harassment' | 'hate' | 'violence' | 'spam' | 'fake' | 'other';

export interface SelfieState {
  submission_id: string;
  status: SubmissionStatus;
  match_id: string | null;
  expires_at: string;
}

export interface MatchView {
  match_id: string;
  created_at: string;
  media_expires_at: string;
  my_selfie_path: string | null;
  their_selfie_path: string | null;
  other_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_path: string | null;
  other_country_code: string | null;
  other_bio: string | null;
  my_decision: MatchDecision;
  i_follow: 'active' | 'requested' | null;
  follows_me: boolean;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

/** Identifiant unique d'un envoi (le même si l'envoi est réessayé). */
export const newRequestId = () => Crypto.randomUUID();

/**
 * Envoie un selfie : compression (1080 px, sans métadonnées), upload dans le
 * bucket privé, puis mise en file d'attente côté serveur.
 */
export async function sendSelfie(userId: string, localUri: string, requestId: string): Promise<SelfieState> {
  const image = await prepareImage(localUri, 1080);
  const path = await uploadImage('selfies', userId, image);
  const rows = await rpc<SelfieState[]>('submit_selfie', { p_path: path, p_client_request_id: requestId });
  if (!rows[0]) throw new Error('submit_failed');
  return rows[0];
}

export async function pollSelfie(submissionId: string): Promise<SelfieState | null> {
  const rows = await rpc<SelfieState[]>('poll_selfie', { p_submission_id: submissionId });
  return rows[0] ?? null;
}

export async function getPendingSelfie(): Promise<SelfieState | null> {
  const rows = await rpc<SelfieState[]>('get_pending_selfie');
  return rows[0] ?? null;
}

export const cancelSelfie = (submissionId: string) => rpc<void>('cancel_selfie', { p_submission_id: submissionId });

export async function getMatch(matchId: string): Promise<MatchView | null> {
  const rows = await rpc<MatchView[]>('get_match', { p_match_id: matchId });
  return rows[0] ?? null;
}

export const getRecentMatches = () => rpc<MatchView[]>('get_recent_matches');

export const decideMatch = (matchId: string, decision: 'follow' | 'pass') =>
  rpc<'active' | 'requested' | null>('decide_match', { p_match_id: matchId, p_decision: decision });

export const reportUser = (targetId: string, context: 'selfie' | 'profile' | 'post' | 'story', contextId: string | null, reason: ReportReason) =>
  rpc<void>('report_user', { p_target: targetId, p_context: context, p_context_id: contextId, p_reason: reason });
