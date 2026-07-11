import { createContext, useContext } from 'react';

import type { Account, Workspace } from '@colanode/client/types';
import type { WorkspaceCollections } from '@colanode/ui/collections';

export interface CurrentWorkspace {
  workspace: Workspace;
  account: Account;
  selectWorkspace: (userId: string) => void;
  collections: WorkspaceCollections;
}

export const CurrentWorkspaceContext = createContext<CurrentWorkspace | null>(
  null
);

export const useCurrentWorkspace = (): CurrentWorkspace => {
  const context = useContext(CurrentWorkspaceContext);
  if (!context) {
    throw new Error('useCurrentWorkspace used outside SessionGate');
  }
  return context;
};
