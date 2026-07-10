import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { getSyncStatusView } from '@colanode/ui/lib/sync-status';
import { cn } from '@colanode/ui/lib/utils';

export const SidebarSyncStatus = () => {
  const workspace = useWorkspace();

  const pendingCountQuery = useLiveQuery({
    type: 'mutation.pending-count',
    userId: workspace.userId,
  });

  const data = pendingCountQuery.data ?? {
    pendingCount: 0,
    serverAvailable: true,
  };
  const view = getSyncStatusView(data.pendingCount, data.serverAvailable);

  return (
    <div className="mx-2 mb-2 flex items-center gap-2.5 rounded-[14px] bg-card px-3 py-2.5">
      <span
        className={cn(
          'size-[9px] shrink-0 rounded-full',
          view.tone === 'spore' ? 'bg-spore' : 'bg-primary',
          view.pulse &&
            'animate-[spore-pulse_var(--motion-spore-period)_ease-in-out_infinite]'
        )}
      />
      <span className="font-mono text-[11px] leading-none text-muted-foreground">
        {view.label}
      </span>
    </div>
  );
};
