import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import type { LoginOutput } from '@colanode/core';
import { Button } from '@colanode/mobile/components/button';
import { SegmentedControl } from '@colanode/mobile/components/segmented-control';
import { TextField } from '@colanode/mobile/components/text-field';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { rememberWorkspace } from '@colanode/mobile/session/remember-workspace';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: palette.background,
      flexGrow: 1,
    },
  });

type Mode = 'login' | 'register';

type Props = NativeStackScreenProps<AuthStackParamList, 'Credentials'>;

export const CredentialsScreen = ({ navigation, route }: Props) => {
  const { serverDomain } = route.params;
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === 'register' && name.trim().length === 0) {
      next.name = 'Enter your name';
    }
    if (!email.includes('@')) {
      next.email = 'Enter a valid email';
    }
    if (password.length < 8) {
      next.password = 'At least 8 characters';
    }
    if (mode === 'register' && confirm !== password) {
      next.confirm = 'Passwords do not match';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleOutput = (output: LoginOutput) => {
    if (output.type === 'verify') {
      navigation.navigate('Verify', {
        serverDomain,
        verifyId: output.id,
        expiresAt: output.expiresAt,
      });
      return;
    }
    // Success: the mutation handler already persisted the account and started
    // sync; SessionGate flips to the main app via its live queries. We only
    // remember which workspace to open.
    rememberWorkspace(output);
  };

  const submit = () => {
    if (!validate()) {
      return;
    }
    if (mode === 'login') {
      mutate({
        input: { type: 'email.login', server: serverDomain, email, password },
        onSuccess: handleOutput,
        onError: (error) => Alert.alert('Sign in failed', error.message),
      });
    } else {
      mutate({
        input: {
          type: 'email.register',
          server: serverDomain,
          name: name.trim(),
          email,
          password,
        },
        onSuccess: handleOutput,
        onError: (error) => Alert.alert('Registration failed', error.message),
      });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SegmentedControl
        testID="auth-mode"
        value={mode}
        onChange={(key) => setMode(key as Mode)}
        options={[
          { key: 'login', label: 'Sign in' },
          { key: 'register', label: 'Create account' },
        ]}
      />
      {mode === 'register' ? (
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          testID="auth-name"
        />
      ) : null}
      <TextField
        label="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        testID="auth-email"
      />
      <TextField
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        testID="auth-password"
      />
      {mode === 'register' ? (
        <TextField
          label="Confirm password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          error={errors.confirm}
          testID="auth-confirm"
        />
      ) : null}
      <Button
        label={mode === 'login' ? 'Sign in' : 'Create account'}
        loading={isPending}
        onPress={submit}
        testID="auth-submit"
      />
    </ScrollView>
  );
};
