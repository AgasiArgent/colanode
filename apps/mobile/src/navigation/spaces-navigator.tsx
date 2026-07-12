import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PageScreen } from '@colanode/mobile/screens/spaces/page-screen';
import { SpaceScreen } from '@colanode/mobile/screens/spaces/space-screen';
import { SpacesScreen } from '@colanode/mobile/screens/spaces/spaces-screen';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { typeScale } from '@colanode/mobile/theme/typography';

export type SpacesStackParamList = {
  SpacesHome: undefined;
  Space: { nodeId: string; title: string };
  Page: { nodeId: string; title: string };
};

const Stack = createNativeStackNavigator<SpacesStackParamList>();

export const SpacesNavigator = () => {
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
        name="SpacesHome"
        component={SpacesScreen}
        options={{ title: 'Spaces' }}
      />
      <Stack.Screen
        name="Space"
        component={SpaceScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen
        name="Page"
        component={PageScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  );
};
