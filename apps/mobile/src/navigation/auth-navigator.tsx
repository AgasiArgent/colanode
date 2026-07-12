import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CredentialsScreen } from '@colanode/mobile/screens/auth/credentials-screen';
import { ServerAddScreen } from '@colanode/mobile/screens/auth/server-add-screen';
import { ServersScreen } from '@colanode/mobile/screens/auth/servers-screen';
import { VerifyScreen } from '@colanode/mobile/screens/auth/verify-screen';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

export type AuthStackParamList = {
  Servers: undefined;
  ServerAdd: undefined;
  Credentials: { serverDomain: string; serverName: string };
  Verify: { serverDomain: string; verifyId: string; expiresAt: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
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
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
        headerBackTitleStyle: { fontFamily: fonts.body },
      }}
    >
      <Stack.Screen
        name="Servers"
        component={ServersScreen}
        options={{ title: 'Choose a server' }}
      />
      <Stack.Screen
        name="ServerAdd"
        component={ServerAddScreen}
        options={{ title: 'Add server' }}
      />
      <Stack.Screen
        name="Credentials"
        component={CredentialsScreen}
        options={({ route }) => ({ title: route.params.serverName })}
      />
      <Stack.Screen
        name="Verify"
        component={VerifyScreen}
        options={{ title: 'Check your email' }}
      />
    </Stack.Navigator>
  );
};
