import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { LoginOutput } from '@colanode/core';
import { Button } from '@colanode/mobile/components/button';
import { TextField } from '@colanode/mobile/components/text-field';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { rememberWorkspace } from '@colanode/mobile/session/remember-workspace';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: palette.background,
    },
    message: { ...typeScale.body, color: palette.textSecondary },
    countdown: {
      ...typeScale.caption,
      fontFamily: fonts.mono,
      color: palette.textMuted,
    },
  });

type Props = NativeStackScreenProps<AuthStackParamList, 'Verify'>;

export const VerifyScreen = ({ route }: Props) => {
  const { serverDomain, verifyId, expiresAt } = route.params;
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = () => {
    mutate({
      input: {
        type: 'email.verify',
        server: serverDomain,
        id: verifyId,
        otp: otp.trim(),
      },
      onSuccess: (output: LoginOutput) => {
        if (output.type === 'success') {
          rememberWorkspace(output);
        }
      },
      onError: (error) => Alert.alert('Verification failed', error.message),
    });
  };

  return (
    <View style={styles.container} testID="auth-verify-screen">
      <Text style={styles.message}>
        We sent a code to your email. Enter it below to finish signing in.
      </Text>
      <TextField
        label="Verification code"
        mono
        keyboardType="number-pad"
        autoCapitalize="none"
        value={otp}
        onChangeText={setOtp}
        testID="auth-otp"
      />
      <Text style={styles.countdown}>
        {secondsLeft > 0
          ? `code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
          : 'code expired — go back and sign in again'}
      </Text>
      <Button
        label="Verify"
        loading={isPending}
        disabled={otp.trim().length === 0 || secondsLeft === 0}
        onPress={submit}
        testID="auth-verify-submit"
      />
    </View>
  );
};
