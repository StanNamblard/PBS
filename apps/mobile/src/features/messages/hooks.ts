import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import { getConversation, getInbox, getInboxCounts, getMessages, PAGE_SIZE, type Folder, type Message } from './api';

export const msgKeys = {
  inbox: (folder: Folder) => ['inbox', folder] as const,
  counts: ['inbox', 'counts'] as const,
  conversation: (otherId: string) => ['conversation', otherId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
};

export const useInbox = (folder: Folder) => useQuery({ queryKey: msgKeys.inbox(folder), queryFn: () => getInbox(folder) });
export const useInboxCounts = () => {
  const { userId } = useAuth();
  return useQuery({ queryKey: msgKeys.counts, queryFn: getInboxCounts, enabled: !!userId });
};
export const useConversation = (otherId: string) =>
  useQuery({ queryKey: msgKeys.conversation(otherId), queryFn: () => getConversation(otherId) });

export function useMessages(conversationId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: msgKeys.messages(conversationId ?? 'none'),
    enabled: !!conversationId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getMessages(conversationId!, pageParam),
    getNextPageParam: (last: Message[]) => (last.length < PAGE_SIZE ? undefined : last[last.length - 1]?.created_at),
  });
}

/**
 * Temps réel global : à chaque nouveau message qui me concerne (la RLS filtre),
 * on rafraîchit la boîte de réception, les badges et la conversation ouverte.
 */
export function useMessagesRealtime() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        void qc.invalidateQueries({ queryKey: ['inbox'] });
        void qc.invalidateQueries({ queryKey: msgKeys.messages(msg.conversation_id) });
        void qc.invalidateQueries({ queryKey: ['conversation'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, () => {
        void qc.invalidateQueries({ queryKey: ['inbox'] });
        void qc.invalidateQueries({ queryKey: ['conversation'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
