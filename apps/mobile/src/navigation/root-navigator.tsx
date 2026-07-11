import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ChatsNavigator } from '@colanode/mobile/navigation/chats-navigator';
import { SettingsNavigator } from '@colanode/mobile/navigation/settings-navigator';
import { InboxScreen } from '@colanode/mobile/screens/inbox/inbox-screen';
import { SpacesScreen } from '@colanode/mobile/screens/spaces/spaces-screen';
import { useRadar } from '@colanode/mobile/session/radar-context';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';

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

export const RootNavigator = () => {
  const { palette } = useTheme();
  const radar = useRadar();
  const chatsUnread = radar.getChatsState();
  const channelsUnread = radar.getChannelsState();
  const chatsBadge = chatsUnread.unreadCount + channelsUnread.unreadCount;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.rail,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: {
          fontFamily: typeScale.h3.fontFamily,
          fontSize: typeScale.h3.fontSize,
          color: palette.textPrimary,
        },
        headerShadowVisible: false,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcons[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsNavigator}
        options={{
          headerShown: false,
          tabBarBadge: chatsBadge > 0 ? chatsBadge : undefined,
          tabBarBadgeStyle: {
            backgroundColor: palette.spore,
            color: palette.background,
            fontFamily: fonts.monoMedium,
            fontSize: 11,
          },
        }}
      />
      <Tab.Screen name="Spaces" component={SpacesScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
};
