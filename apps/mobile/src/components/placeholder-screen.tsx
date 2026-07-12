import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { spacing } from '@colanode/mobile/theme/tokens';
import { typeScale } from '@colanode/mobile/theme/typography';

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: palette.background,
    },
    title: { ...typeScale.h3, color: palette.textPrimary },
    subtitle: { ...typeScale.body, color: palette.textMuted },
  });

interface PlaceholderScreenProps {
  title: string;
}

export const PlaceholderScreen = ({ title }: PlaceholderScreenProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.container} testID={`placeholder-${title.toLowerCase()}`}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
};
