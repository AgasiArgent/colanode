import { Outlet, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SidebarDesktop } from '@colanode/ui/components/layouts/sidebars/sidebar-desktop';
import { ThreadPanel } from '@colanode/ui/components/layouts/thread-panel';
import { ThreadPanelContext } from '@colanode/ui/contexts/thread-panel';
import { useIsMobile } from '@colanode/ui/hooks/use-is-mobile';

export const WorkspaceLayout = () => {
  const isMobile = useIsMobile();
  const [threadRootId, setThreadRootId] = useState<string | null>(null);

  // close the panel whenever the active route changes (stale-panel guard)
  const location = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setThreadRootId(null);
  }, [location]);

  const openThread = useCallback((id: string) => setThreadRootId(id), []);
  const closeThread = useCallback(() => setThreadRootId(null), []);
  const value = useMemo(
    () => ({ threadRootId, openThread, closeThread }),
    [threadRootId, openThread, closeThread]
  );

  return (
    <ThreadPanelContext.Provider value={value}>
      <div className="w-full h-full flex">
        {!isMobile && <SidebarDesktop />}
        <section className="min-w-0 flex-1">
          <Outlet />
        </section>
        {!isMobile && <ThreadPanel />}
      </div>
    </ThreadPanelContext.Provider>
  );
};
