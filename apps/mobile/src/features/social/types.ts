export type FollowStatus = 'active' | 'requested';

export interface ProfileDetails {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  country_code: string | null;
  is_private: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_me: boolean;
  i_follow: FollowStatus | null;
  follows_me: boolean;
  can_view: boolean;
}

export interface UserRowData {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  since?: string;
  viewed_at?: string;
  i_follow?: FollowStatus | null;
}

export interface MediaItem {
  path: string;
  width: number | null;
  height: number | null;
}

export interface Post {
  id: string;
  author_id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  caption: string | null;
  created_at: string;
  media: MediaItem[];
}

export interface StoryTrayItem {
  author_id: string;
  username: string;
  avatar_path: string | null;
  is_me: boolean;
  latest_at: string;
  has_unseen: boolean;
}

export interface Story {
  id: string;
  storage_path: string;
  created_at: string;
  expires_at: string;
  viewed: boolean;
  view_count: number | null;
}
