import { LocalChannelNode } from '@colanode/client/types';

interface ChannelBreadcrumbItemProps {
  channel: LocalChannelNode;
}

export const ChannelBreadcrumbItem = ({
  channel,
}: ChannelBreadcrumbItemProps) => {
  return (
    <div className="flex cursor-pointer items-center gap-1.5">
      <span
        aria-hidden="true"
        className="font-mono text-sm font-medium text-primary"
      >
        #
      </span>
      <span className="font-display text-[15px] font-bold text-foreground">
        {channel.name}
      </span>
    </div>
  );
};
