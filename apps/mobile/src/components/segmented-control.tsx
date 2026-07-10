import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts } from '@colanode/mobile/theme/typography';

interface SegmentedControlProps {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  testID?: string;
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      padding: 2,
      gap: 2,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: { backgroundColor: palette.accentSoft },
    label: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  });

export const SegmentedControl = ({
  options,
  value,
  onChange,
  testID,
}: SegmentedControlProps) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.track} testID={testID} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.key)}
            testID={testID ? `${testID}-${option.key}` : undefined}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? palette.accentSoftForeground
                    : palette.textMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
