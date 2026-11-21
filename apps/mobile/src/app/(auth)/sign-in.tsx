import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { isAppleSignInAvailable, sendEmailOtp, signInWithApple } from '@/features/auth/api';
import { isValidEmail } from '@/features/auth/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError(t('signIn.invalidEmail'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendEmailOtp(email);
      router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase() } });
    } catch {
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const apple = async () => {
    try {
      await signInWithApple();
      // La navigation est automatique : la session change → redirection.
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setError(t('errors.generic'));
    }
  };

  return (
    <Screen scroll footer={<Button testID="send-code" label={t('signIn.sendCode')} onPress={submit} loading={loading} />}>
      <AppText variant="title">{t('signIn.title')}</AppText>
      <AppText muted>{t('signIn.subtitle')}</AppText>
      <TextField
        testID="email-input"
        label={t('signIn.email')}
        placeholder={t('signIn.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        error={error}
      />
      {appleAvailable ? (
        <View style={styles.alt}>
          <AppText variant="caption" muted center>
            {t('signIn.or')}
          </AppText>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.pill}
            style={styles.apple}
            onPress={apple}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  alt: { gap: spacing.md, marginTop: spacing.md },
  apple: { height: 54 },
});
