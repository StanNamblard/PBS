import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { sendEmailOtp, verifyEmailOtp } from '@/features/auth/api';
import { isValidOtp } from '@/features/auth/validation';
import { typography } from '@/theme/tokens';

const RESEND_DELAY = 60;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_DELAY);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const submit = async (value = code) => {
    if (!isValidOtp(value)) return;
    setLoading(true);
    setError(null);
    try {
      await verifyEmailOtp(email, value);
      // Session créée → le routeur racine redirige automatiquement.
    } catch {
      setError(t('verify.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void submit(digits);
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t('verify.submit')} onPress={() => void submit()} loading={loading} disabled={!isValidOtp(code)} />
          <Button
            variant="ghost"
            label={countdown > 0 ? t('verify.resendIn', { s: countdown }) : t('verify.resend')}
            disabled={countdown > 0}
            onPress={() => {
              setCountdown(RESEND_DELAY);
              void sendEmailOtp(email).catch(() => setError(t('errors.generic')));
            }}
          />
          <Button variant="ghost" label={t('verify.changeEmail')} onPress={() => router.back()} />
        </>
      }
    >
      <AppText variant="title">{t('verify.title')}</AppText>
      <AppText muted>{t('verify.subtitle', { email })}</AppText>
      <TextField
        testID="otp-input"
        label={t('verify.code')}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        style={{ ...typography.title, letterSpacing: 8, textAlign: 'center' }}
        error={error}
      />
    </Screen>
  );
}
