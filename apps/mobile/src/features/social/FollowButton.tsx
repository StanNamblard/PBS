import { useTranslation } from 'react-i18next';

import { SmallButton } from '@/components/SmallButton';
import { confirm } from '@/lib/dialogs';

import { useFollowActions } from './hooks';
import type { FollowStatus } from './types';

interface Props {
  userId: string;
  username: string;
  status: FollowStatus | null | undefined;
  followsMe?: boolean;
  flex?: boolean;
}

/** Suivre / Demandé / Abonné(e), avec confirmation avant de ne plus suivre. */
export function FollowButton({ userId, username, status, followsMe, flex }: Props) {
  const { t } = useTranslation();
  const { follow, unfollow } = useFollowActions();
  const loading = follow.isPending || unfollow.isPending;

  if (!status) {
    return (
      <SmallButton
        flex={flex}
        variant="primary"
        loading={loading}
        label={followsMe ? t('profile.followBack') : t('profile.follow')}
        onPress={() => follow.mutate(userId)}
      />
    );
  }

  const confirmLabel = status === 'requested' ? t('profile.cancelRequest') : t('profile.unfollow');
  return (
    <SmallButton
      flex={flex}
      loading={loading}
      label={status === 'requested' ? t('profile.requested') : t('profile.followingButton')}
      onPress={() =>
        void confirm({
          title: status === 'requested' ? t('profile.cancelRequest') : t('profile.unfollowConfirm', { username }),
          confirmText: confirmLabel,
          cancelText: t('common.cancel'),
          destructive: true,
        }).then((ok) => ok && unfollow.mutate(userId))
      }
    />
  );
}
