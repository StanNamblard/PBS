import { useLocalSearchParams } from 'expo-router';

import { FollowListScreen } from '@/features/social/FollowListScreen';

export default function FollowersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowListScreen userId={id} kind="followers" />;
}
