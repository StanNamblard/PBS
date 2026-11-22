import { prepareImage, uploadImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

export type Folder = 'primary' | 'requests';

export interface InboxItem {
  conversation_id: string;
  other_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_path: string | null;
  last_message_at: string;
  last_body: string | null;
  last_has_media: boolean;
  last_from_me: boolean;
  unread: boolean;
}

export interface ConversationInfo {
  conversation_id: string | null;
  other_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_path: string | null;
  my_folder: Folder;
  i_accepted: boolean;
  can_send: boolean;
  blocked_reason: 'must_follow' | 'request_pending' | null;
  other_accepted: boolean;
  other_last_read_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  created_at: string;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const getInbox = (folder: Folder) => rpc<InboxItem[]>('get_inbox', { p_folder: folder });

export async function getInboxCounts(): Promise<{ primary_unread: number; requests: number }> {
  const rows = await rpc<{ primary_unread: number; requests: number }[]>('get_inbox_counts');
  return rows[0] ?? { primary_unread: 0, requests: 0 };
}

export async function getConversation(otherId: string): Promise<ConversationInfo | null> {
  const rows = await rpc<ConversationInfo[]>('get_conversation', { p_other: otherId });
  return rows[0] ?? null;
}

export const PAGE_SIZE = 40;

/** Messages du plus récent au plus ancien (la RLS ne renvoie que ce que j'ai le droit de lire). */
export async function getMessages(conversationId: string, before?: string): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, media_path, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return data as Message[];
}

export const sendText = (to: string, body: string) => rpc<string>('send_message', { p_to: to, p_body: body, p_media_path: null });

export async function sendPhoto(userId: string, to: string, localUri: string): Promise<string> {
  const image = await prepareImage(localUri, 1440);
  const path = await uploadImage('dm', userId, image);
  return rpc<string>('send_message', { p_to: to, p_body: null, p_media_path: path });
}

export const markRead = (conversationId: string) => rpc<void>('mark_conversation_read', { p_conversation: conversationId });
export const acceptConversation = (conversationId: string) => rpc<void>('accept_conversation', { p_conversation: conversationId });
export const deleteConversation = (conversationId: string) => rpc<void>('delete_conversation', { p_conversation: conversationId });

// Blocage
export const blockUser = (userId: string) => rpc<void>('block_user', { p_target: userId });
export const unblockUser = (userId: string) => rpc<void>('unblock_user', { p_target: userId });
export const getBlockedUsers = () =>
  rpc<{ id: string; username: string; display_name: string | null; avatar_path: string | null; since: string }[]>('get_blocked_users');
