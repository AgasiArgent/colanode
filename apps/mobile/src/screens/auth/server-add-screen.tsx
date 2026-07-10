import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@colanode/mobile/components/button';
import { TextField } from '@colanode/mobile/components/text-field';
import { type AuthStackParamList } from '@colanode/mobile/navigation/auth-navigator';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: palette.background,
    },
    hint: { ...typeScale.caption, color: palette.textMuted },
  });

type Props = NativeStackScreenProps<AuthStackParamList, 'ServerAdd'>;

export const ServerAddScreen = ({ navigation }: Props) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { isPending, mutate } = useMutation();

  const submit = () => {
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError('Enter the full config URL, starting with https://');
      return;
    }
    setError(undefined);
    mutate({
      input: { type: 'server.create', url: trimmed },
      onSuccess: () => navigation.goBack(),
      onError: (mutationError) =>
        Alert.alert('Could not add server', mutationError.message),
    });
  };

  return (
    <View style={styles.container}>
      <TextField
        label="Server config URL"
        mono
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://your-server.dev/config"
        value={url}
        onChangeText={setUrl}
        error={error}
        testID="server-add-url"
      />
      <Text style={styles.hint}>
        The full /config URL of a self-hosted server — for example
        https://chat.example.com/config.
      </Text>
      <Button
        label="Add server"
        loading={isPending}
        onPress={submit}
        testID="server-add-submit"
      />
    </View>
  );
};
