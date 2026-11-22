import { supabase } from '@/lib/supabase';
import { prepareImage, removeFiles, uploadImage } from '@/lib/media';

import type { FollowStatus, Post, ProfileDetails, Story, StoryTrayItem, UserRowData } from './types';

/** Appelle une fonction RPC et lève l'erreur éventuelle. */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------------------
// Profils & follow
// ---------------------------------------------------------------------------
export async function getProfile(userId: string): Promise<ProfileDetails | null> {
  const rows = await rpc<ProfileDetails[]>('get_profile', { p_user_id: userId });
  return rows[0] ?? null;
}

export const followUser = (userId: string) => rpc<FollowStatus>('follow_user', { p_target: userId });
export const unfollowUser = (userId: string) => rpc<void>('unfollow_user', { p_target: userId });
export const removeFollower = (userId: string) => rpc<void>('remove_follower', { p_follower: userId });
export const respondFollowRequest = (userId: string, accept: boolean) =>
  rpc<void>('respond_follow_request', { p_follower: userId, p_accept: accept });

export const getFollowers = (userId: string, before?: string) =>
  rpc<UserRowData[]>('get_followers', { p_user_id: userId, p_before: before ?? null, p_limit: 30 });
export const getFollowing = (userId: string, before?: string) =>
  rpc<UserRowData[]>('get_following', { p_user_id: userId, p_before: before ?? null, p_limit: 30 });
export const getFollowRequests = () => rpc<UserRowData[]>('get_follow_requests');

export interface ProfileUpdate {
  username?: string;
  display_name?: string | null;
  bio?: string | null;
  country_code?: string | null;
  avatar_path?: string | null;
  is_private?: boolean;
}

export async function updateMyProfile(userId: string, update: ProfileUpdate) {
  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------
export const getFeed = (before?: string) => rpc<Post[]>('get_feed', { p_before: before ?? null, p_limit: 15 });
export const getUserPosts = (userId: string, before?: string) =>
  rpc<Post[]>('get_user_posts', { p_user_id: userId, p_before: before ?? null, p_limit: 30 });
export async function getPost(postId: string): Promise<Post | null> {
  const rows = await rpc<Post[]>('get_post', { p_post_id: postId });
  return rows[0] ?? null;
}

export const POST_MAX_PHOTOS = 10;
export const CAPTION_MAX = 2200;

/**
 * Publie une photo ou un carrousel : compression, envoi des fichiers, puis
 * création de la publication côté serveur. En cas d'échec, les fichiers déjà
 * envoyés sont supprimés.
 */
export async function createPost(
  userId: string,
  localUris: string[],
  caption: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const uploaded: string[] = [];
  try {
    const media = [];
    for (const [i, uri] of localUris.entries()) {
      const image = await prepareImage(uri, 1440);
      const path = await uploadImage('posts', userId, image);
      uploaded.push(path);
      media.push({ path, width: image.width, height: image.height });
      onProgress?.(i + 1, localUris.length);
    }
    return await rpc<string>('create_post', { p_caption: caption, p_media: media });
  } catch (e) {
    await removeFiles('posts', uploaded).catch(() => undefined);
    throw e;
  }
}

export async function deletePost(post: Post) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) throw error;
  await removeFiles('posts', post.media.map((m) => m.path)).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
export const getStoryTray = () => rpc<StoryTrayItem[]>('get_story_tray');
export const getUserStories = (userId: string) => rpc<Story[]>('get_user_stories', { p_user_id: userId });
export const markStoryViewed = (storyId: string) => rpc<void>('mark_story_viewed', { p_story_id: storyId });
export const getStoryViewers = (storyId: string) => rpc<UserRowData[]>('get_story_viewers', { p_story_id: storyId });

export async function createStory(userId: string, localUri: string): Promise<string> {
  const image = await prepareImage(localUri, 1080);
  const path = await uploadImage('stories', userId, image);
  try {
    return await rpc<string>('create_story', { p_path: path });
  } catch (e) {
    await removeFiles('stories', [path]).catch(() => undefined);
    throw e;
  }
}

export async function deleteStory(story: Story) {
  const { error } = await supabase.from('stories').delete().eq('id', story.id);
  if (error) throw error;
  await removeFiles('stories', [story.storage_path]).catch(() => undefined);
}
