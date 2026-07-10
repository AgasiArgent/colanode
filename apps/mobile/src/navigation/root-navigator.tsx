import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ChatsScreen } from '@colanode/mobile/screens/chats/chats-screen';
import { InboxScreen } from '@colanode/mobile/screens/inbox/inbox-screen';
import { SettingsScreen } from '@colanode/mobile/screens/settings/settings-screen';
import { SpacesScreen } from '@colanode/mobile/screens/spaces/spaces-screen';
import { tokens } from '@colanode/mobile/theme/tokens';

// Per-tab native stacks arrive with the first inner screens (M2 auth flows,
// M3 conversation screen) — a tabs-only skeleton is the M1 scope.
export type RootTabParamList = {
  Chats: undefined;
  Spaces: undefined;
  Inbox: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const tabIcons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> =
  {
    Chats: 'chatbubbles-outline',
    Spaces: 'grid-outline',
    Inbox: 'notifications-outline',
    Settings: 'settings-outline',
  };

export const RootNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarActiveTintColor: tokens.colors.accent,
      tabBarInactiveTintColor: tokens.colors.textMuted,
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={tabIcons[route.name]} color={color} size={size} />
      ),
    })}
  >
    <Tab.Screen name="Chats" component={ChatsScreen} />
    <Tab.Screen name="Spaces" component={SpacesScreen} />
    <Tab.Screen name="Inbox" component={InboxScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);
