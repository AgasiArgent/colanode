import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatsScreen } from '@colanode/mobile/screens/chats/chats-screen';
import { ConversationScreen } from '@colanode/mobile/screens/chats/conversation-screen';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { typeScale } from '@colanode/mobile/theme/typography';

export type ChatsStackParamList = {
  ChatsHome: undefined;
  Conversation: { nodeId: string; title: string };
};

const Stack = createNativeStackNavigator<ChatsStackParamList>();

export const ChatsNavigator = () => {
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
        name="ChatsHome"
        component={ChatsScreen}
        options={{ title: 'Chats' }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  );
};
