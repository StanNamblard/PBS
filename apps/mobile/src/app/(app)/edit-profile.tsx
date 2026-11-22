import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { isValidUsername, normalizeUsername } from '@/features/auth/validation';
import { isUsernameAvailable, uploadAvatar } from '@/features/onboarding/api';
import { CountryPicker } from '@/features/onboarding/CountryPicker';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { updateMyProfile } from '@/features/social/api';
import { serverErrorKey } from '@/lib/errors';
import { publicUrl, removeFiles } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setCountry(profile.country_code);
  }, [profile]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!userId || !profile) return;
    setError(null);
    setUsernameError(null);
    if (!isValidUsername(username)) return setUsernameError(t('profileSetup.usernameInvalid'));
    setSaving(true);
    try {
      if (username !== profile.username && !(await isUsernameAvailable(username))) {
        setUsernameError(t('profileSetup.usernameTaken'));
        return;
      }
      const avatarPath = photoUri ? await uploadAvatar(userId, photoUri) : profile.avatar_path;
      await updateMyProfile(userId, {
        username,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        country_code: country,
        avatar_path: avatarPath,
      });
      // L'ancienne photo n'est plus utilisée : on la supprime
      if (photoUri && profile.avatar_path) await removeFiles('avatars', [profile.avatar_path]).catch(() => undefined);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    } catch (e) {
      setError(t(serverErrorKey(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Header title={t('editProfile.title')} />
      <Screen scroll footer={<Button label={t('common.save')} loading={saving} onPress={() => void save()} />}>
        <Pressable onPress={pickPhoto} style={styles.avatar} accessibilityRole="button">
          <Avatar uri={photoUri ?? publicUrl(profile?.avatar_path)} name={username} size={104} />
          <AppText variant="caption" color={colors.primary}>
            {t('profileSetup.changePhoto')}
          </AppText>
        </Pressable>
        <TextField
          label={t('profileSetup.username')}
          value={username}
          onChangeText={(v) => setUsername(normalizeUsername(v))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          error={usernameError}
          hint={t('profileSetup.usernameHint')}
        />
        <TextField label={t('profileSetup.displayName')} value={displayName} onChangeText={setDisplayName} maxLength={50} />
        <TextField
          label={t('profileSetup.bio')}
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          style={styles.bio}
          hint={t('profileSetup.bioCounter', { n: bio.length })}
        />
        <CountryPicker value={country} onChange={setCountry} />
        {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', gap: spacing.sm },
  bio: { minHeight: 88, textAlignVertical: 'top' },
});
