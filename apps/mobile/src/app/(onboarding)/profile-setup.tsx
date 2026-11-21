import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { isValidUsername, normalizeUsername } from '@/features/auth/validation';
import { completeOnboarding, isUsernameAvailable, uploadAvatar } from '@/features/onboarding/api';
import { CountryPicker } from '@/features/onboarding/CountryPicker';
import { serverErrorKey } from '@/lib/errors';
import { deviceCountry } from '@/lib/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId, refreshOnboarding } = useAuth();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState<string | null>(deviceCountry());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Vérification de disponibilité du pseudo (avec délai pour éviter une requête par lettre)
  useEffect(() => {
    if (!username) return setAvailability('idle');
    if (!isValidUsername(username)) return setAvailability('invalid');
    setAvailability('checking');
    let cancelled = false;
    const id = setTimeout(() => {
      isUsernameAvailable(username)
        .then((ok) => !cancelled && setAvailability(ok ? 'available' : 'taken'))
        .catch(() => !cancelled && setAvailability('idle'));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [username]);

  const pickPhoto = async () => {
    // La galerie est autorisée pour la photo de profil (pas pour le selfie du jour).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!userId || availability !== 'available') return;
    setLoading(true);
    setError(null);
    try {
      const avatarPath = photoUri ? await uploadAvatar(userId, photoUri) : null;
      await completeOnboarding({ username, displayName, bio, countryCode: country, avatarPath });
      await refreshOnboarding();
      router.replace('/home');
    } catch (e) {
      setError(t(serverErrorKey(e)));
    } finally {
      setLoading(false);
    }
  };

  const usernameMessage =
    availability === 'available'
      ? t('profileSetup.usernameAvailable')
      : availability === 'taken'
        ? t('profileSetup.usernameTaken')
        : availability === 'invalid'
          ? t('profileSetup.usernameInvalid')
          : null;

  return (
    <Screen
      scroll
      footer={
        <Button
          testID="profile-finish"
          label={t('profileSetup.finish')}
          onPress={submit}
          loading={loading}
          disabled={availability !== 'available' || !country}
        />
      }
    >
      <AppText variant="title">{t('profileSetup.title')}</AppText>
      <AppText muted>{t('profileSetup.subtitle')}</AppText>

      <Pressable onPress={pickPhoto} style={styles.avatar} accessibilityRole="button">
        <Avatar uri={photoUri} name={username || '?'} size={112} />
        <AppText variant="caption" color={colors.primary}>
          {photoUri ? t('profileSetup.changePhoto') : t('profileSetup.addPhoto')}
        </AppText>
      </Pressable>

      <TextField
        testID="username-input"
        label={t('profileSetup.username')}
        value={username}
        onChangeText={(v) => setUsername(normalizeUsername(v))}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        hint={availability === 'available' ? usernameMessage ?? undefined : t('profileSetup.usernameHint')}
        error={availability === 'taken' || availability === 'invalid' ? usernameMessage : null}
      />
      <TextField label={t('profileSetup.displayName')} value={displayName} onChangeText={setDisplayName} maxLength={50} />
      <View>
        <TextField
          label={t('profileSetup.bio')}
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          style={styles.bio}
          hint={t('profileSetup.bioCounter', { n: bio.length })}
        />
      </View>
      <CountryPicker value={country} onChange={setCountry} />
      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  bio: { minHeight: 88, textAlignVertical: 'top' },
});
