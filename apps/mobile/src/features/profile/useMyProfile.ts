import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export interface Profile {
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
}

export function useMyProfile() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['profile', 'me', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_path, country_code, is_private, followers_count, following_count, posts_count')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}
