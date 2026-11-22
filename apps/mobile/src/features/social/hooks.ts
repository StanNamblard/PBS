import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  followUser,
  getFeed,
  getFollowers,
  getFollowing,
  getFollowRequests,
  getProfile,
  getStoryTray,
  getUserPosts,
  removeFollower,
  respondFollowRequest,
  unfollowUser,
} from './api';
import type { Post, UserRowData } from './types';

export const keys = {
  profile: (id: string) => ['profile', id] as const,
  feed: ['feed'] as const,
  tray: ['storyTray'] as const,
  userPosts: (id: string) => ['userPosts', id] as const,
  followers: (id: string) => ['followers', id] as const,
  following: (id: string) => ['following', id] as const,
  requests: ['followRequests'] as const,
};

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: keys.profile(userId ?? ''),
    enabled: !!userId,
    queryFn: () => getProfile(userId!),
  });
}

/** Pagination par date : la page suivante commence avant le dernier élément reçu. */
function nextCursor<T>(last: T[], size: number, pick: (item: T) => string | undefined) {
  if (last.length < size) return undefined;
  const item = last[last.length - 1];
  return item ? pick(item) : undefined;
}

export function useFeed() {
  return useInfiniteQuery({
    queryKey: keys.feed,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getFeed(pageParam),
    getNextPageParam: (last: Post[]) => nextCursor(last, 15, (p) => p.created_at),
  });
}

export function useUserPosts(userId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.userPosts(userId),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getUserPosts(userId, pageParam),
    getNextPageParam: (last: Post[]) => nextCursor(last, 30, (p) => p.created_at),
  });
}

export function useStoryTray() {
  return useQuery({ queryKey: keys.tray, queryFn: getStoryTray });
}

export function useFollowList(kind: 'followers' | 'following', userId: string) {
  return useInfiniteQuery({
    queryKey: kind === 'followers' ? keys.followers(userId) : keys.following(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => (kind === 'followers' ? getFollowers(userId, pageParam) : getFollowing(userId, pageParam)),
    getNextPageParam: (last: UserRowData[]) => nextCursor(last, 30, (u) => u.since),
  });
}

export function useFollowRequests() {
  return useQuery({ queryKey: keys.requests, queryFn: getFollowRequests });
}

/** Rafraîchit tout ce qui dépend des relations après un follow/unfollow. */
function useInvalidateSocial() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: keys.feed }),
      qc.invalidateQueries({ queryKey: keys.tray }),
      qc.invalidateQueries({ queryKey: ['followers'] }),
      qc.invalidateQueries({ queryKey: ['following'] }),
      qc.invalidateQueries({ queryKey: keys.requests }),
      qc.invalidateQueries({ queryKey: ['userPosts'] }),
    ]);
}

export function useFollowActions() {
  const invalidate = useInvalidateSocial();
  const follow = useMutation({ mutationFn: followUser, onSettled: invalidate });
  const unfollow = useMutation({ mutationFn: unfollowUser, onSettled: invalidate });
  const remove = useMutation({ mutationFn: removeFollower, onSettled: invalidate });
  const respond = useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) => respondFollowRequest(userId, accept),
    onSettled: invalidate,
  });
  return { follow, unfollow, remove, respond };
}

export function useInvalidateContent() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.feed }),
      qc.invalidateQueries({ queryKey: keys.tray }),
      qc.invalidateQueries({ queryKey: ['userPosts'] }),
      qc.invalidateQueries({ queryKey: ['profile'] }),
    ]);
}
