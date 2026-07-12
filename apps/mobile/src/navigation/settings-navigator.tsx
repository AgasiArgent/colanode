import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SettingsScreen } from '@colanode/mobile/screens/settings/settings-screen';
import { WorkspacePickerScreen } from '@colanode/mobile/screens/settings/workspace-picker-screen';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { typeScale } from '@colanode/mobile/theme/typography';

export type SettingsStackParamList = {
  SettingsHome: undefined;
  WorkspacePicker: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsNavigator = () => {
  const { palette } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: {
          fontFamily: typeScale.h3.fontFamily,
          fontSize: typeScale.h3.fontSize,
          color: palette.textPrimary,
        },
        headerTintColor: palette.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="WorkspacePicker"
        component={WorkspacePickerScreen}
        options={{ title: 'Workspace' }}
      />
    </Stack.Navigator>
  );
};
