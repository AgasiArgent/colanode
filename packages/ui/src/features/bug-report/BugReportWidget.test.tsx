/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WorkspaceContext } from '@colanode/ui/contexts/workspace';

import { BugReportWidget } from './BugReportWidget';

vi.mock('@agent-native/pinpoint', () => ({
  mountPinpoint: vi.fn(() => ({ dispose: vi.fn() })),
  MemoryStore: class {
    load = vi.fn();
    save = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    list = vi.fn().mockResolvedValue([]);
    clear = vi.fn();
  },
}));

function renderForMember() {
  return render(
    <WorkspaceContext.Provider
      value={
        {
          workspaceId: 'ws1',
          accountId: 'a1',
          userId: 'u1',
          role: 'member',
          collections: {} as never,
        } as never
      }
    >
      <BugReportWidget />
    </WorkspaceContext.Provider>
  );
}

describe('features/bug-report/BugReportWidget', () => {
  it('renders the note panel for a workspace member', () => {
    renderForMember();
    expect(screen.getByTestId('bug-report-panel')).toBeInTheDocument();
  });
});
