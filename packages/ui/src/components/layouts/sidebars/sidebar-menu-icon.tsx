import {
  UnreadBadge,
  UnreadBadgeProps,
} from '@colanode/ui/components/ui/unread-badge';
import { cn } from '@colanode/ui/lib/utils';

interface SidebarMenuIconProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  unreadBadge?: UnreadBadgeProps;
  className?: string;
}

export const SidebarMenuIcon = ({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  unreadBadge,
  className,
}: SidebarMenuIconProps) => {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'size-11 flex items-center justify-center cursor-pointer hover:bg-sidebar-accent rounded-[14px] relative',
        className,
        isActive ? 'bg-sidebar-accent' : ''
      )}
      onClick={onClick}
    >
      <Icon
        className={cn(
          'size-5',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      />
      {unreadBadge && (
        <UnreadBadge
          {...unreadBadge}
          className={cn('absolute top-0 right-0', unreadBadge.className)}
        />
      )}
    </button>
  );
};
