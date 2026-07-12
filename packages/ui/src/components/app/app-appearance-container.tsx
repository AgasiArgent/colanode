import { Check, Laptop, Moon, Sun } from 'lucide-react';

import { ThemeMode } from '@colanode/client/types';
import { AppAppearanceBreadcrumb } from '@colanode/ui/components/app/app-appearance-breadcrumb';
import { AppChatSettings } from '@colanode/ui/components/app/app-chat-settings';
import { AppNotificationSettings } from '@colanode/ui/components/app/app-notification-settings';
import { Container } from '@colanode/ui/components/layouts/containers/container';
import { Button } from '@colanode/ui/components/ui/button';
import { Separator } from '@colanode/ui/components/ui/separator';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { cn } from '@colanode/ui/lib/utils';

interface ThemeModeOption {
  key: string;
  value: ThemeMode | null;
  label: string;
  icon: typeof Laptop;
  title: string;
}

const themeModeOptions: ThemeModeOption[] = [
  {
    key: 'system',
    value: null,
    label: 'System',
    icon: Laptop,
    title: 'Follow system',
  },
  {
    key: 'light',
    value: 'light',
    label: 'Light',
    icon: Sun,
    title: 'Light theme',
  },
  {
    key: 'dark',
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    title: 'Dark theme',
  },
];

export const AppAppearanceContainer = () => {
  const [themeMode, setThemeMode] = useMetadata('app', 'theme.mode');

  return (
    <Container type="full" breadcrumb={<AppAppearanceBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Appearance</h2>
          <Separator className="mt-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {themeModeOptions.map((option) => {
            const isActive =
              option.value === null ? !themeMode : themeMode === option.value;
            const Icon = option.icon;

            return (
              <Button
                key={option.key}
                variant="outline"
                aria-pressed={isActive}
                onClick={() => {
                  setThemeMode(option.value ?? undefined);
                }}
                className={cn(
                  'h-10 w-full justify-start gap-2 relative',
                  isActive && 'ring-1 ring-ring border-primary'
                )}
                title={option.title}
              >
                <Icon className="size-5" />
                {option.label}
                {isActive && (
                  <Check className="size-5 absolute -top-2 -right-2 text-background bg-primary rounded-full p-0.5" />
                )}
              </Button>
            );
          })}
        </div>

        <AppChatSettings />

        <AppNotificationSettings />
      </div>
    </Container>
  );
};
