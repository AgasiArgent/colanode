import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { Account } from '@colanode/client/types';
import { Button } from '@colanode/mobile/components/button';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: palette.background,
    },
    title: { ...typeScale.h2, color: palette.textPrimary, textAlign: 'center' },
    message: {
      ...typeScale.body,
      color: palette.textMuted,
      textAlign: 'center',
    },
  });

export const NoWorkspaceScreen = ({ account }: { account: Account }) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { isPending, mutate } = useMutation();

  return (
    <View style={styles.container} testID="no-workspace-screen">
      <Text style={styles.title}>No workspace yet</Text>
      <Text style={styles.message}>
        {account.email} has no workspaces. Create one on desktop or web, then
        come back — it will appear here automatically.
      </Text>
      <Button
        label="Sign out"
        variant="secondary"
        loading={isPending}
        testID="no-workspace-signout"
        onPress={() =>
          mutate({
            input: { type: 'account.logout', accountId: account.id },
            onError: (error) => Alert.alert('Sign out failed', error.message),
          })
        }
      />
    </View>
  );
};
