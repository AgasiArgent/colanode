import * as React from 'react';

import { cn } from '@colanode/ui/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-card flex field-sizing-content min-h-16 w-full rounded-md border px-3.5 py-2 text-base transition-[color,border-color,box-shadow] duration-[var(--motion-micro-duration)] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-primary focus-visible:ring-ring/15 focus-visible:ring-[3px]',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
