import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { getIdType, IdType } from '@colanode/core';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

export interface UnreadState {
  hasUnread: boolean;
  unreadCount: number;
}

const EMPTY: UnreadState = { hasUnread: false, unreadCount: 0 };

interface Radar {
  getNodeState: (nodeId: string) => UnreadState;
  getChatsState: () => UnreadState;
  getChannelsState: () => UnreadState;
  markNodeAsSeen: (nodeId: string) => void;
}

const RadarContext = createContext<Radar | null>(null);

export const useRadar = (): Radar => {
  const context = useContext(RadarContext);
  if (!context) {
    throw new Error('useRadar used outside RadarProvider');
  }
  return context;
};

const sum = (states: UnreadState[]): UnreadState => ({
  hasUnread: states.some((s) => s.hasUnread),
  unreadCount: states.reduce((acc, s) => acc + s.unreadCount, 0),
});

export const RadarProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const radarQuery = useLiveQuery({ type: 'radar.data.get' });

  const value = useMemo((): Radar => {
    const nodeStates = radarQuery.data?.[userId]?.nodeStates ?? {};
    const byIdType = (idType: IdType) =>
      sum(
        Object.entries(nodeStates)
          .filter(([nodeId]) => getIdType(nodeId) === idType)
          .map(([, state]) => state)
      );

    return {
      getNodeState: (nodeId) => nodeStates[nodeId] ?? EMPTY,
      getChatsState: () => byIdType(IdType.Chat),
      getChannelsState: () => byIdType(IdType.Channel),
      markNodeAsSeen: (nodeId) => {
        window.colanode
          .executeMutation({ type: 'node.interaction.seen', userId, nodeId })
          .catch((error) =>
            console.warn('[Mobile] mark-seen failed', nodeId, error)
          );
      },
    };
  }, [radarQuery.data, userId]);

  return <RadarContext.Provider value={value}>{children}</RadarContext.Provider>;
};
