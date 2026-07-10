import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@colanode/mobile/theme/tokens';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.background,
  },
  title: {
    fontSize: tokens.fontSize.lg,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.textMuted,
  },
});

interface PlaceholderScreenProps {
  title: string;
}

export const PlaceholderScreen = ({ title }: PlaceholderScreenProps) => (
  <View style={styles.container} testID={`placeholder-${title.toLowerCase()}`}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>Coming soon</Text>
  </View>
);
