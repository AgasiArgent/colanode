import { cn } from '@colanode/ui/lib/utils';

export interface UnreadBadgeProps {
  count: number;
  unread: boolean;
  className?: string;
  maxCount?: number;
}

export const UnreadBadge = ({
  count,
  unread,
  className,
  maxCount,
}: UnreadBadgeProps) => {
  if (count === 0 && !unread) {
    return null;
  }

  if (count > 0) {
    return (
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 text-xs font-medium bg-spore text-spore-foreground',
          className
        )}
      >
        {maxCount && count > maxCount ? `${maxCount}+` : count}
      </span>
    );
  }

  return <span className={cn('size-2 rounded-full bg-spore', className)} />;
};
