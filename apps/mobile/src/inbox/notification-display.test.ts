import { describe, expect, it } from 'vitest';

import type { LocalNode } from '@colanode/client/types';
import type { User } from '@colanode/client/types';
import {
  conversationTitle,
  formatRelativeTime,
  notificationLabel,
} from './notification-display';

describe('notificationLabel', () => {
  it('labels known types', () => {
    expect(notificationLabel('mention')).toBe('mentioned you');
    expect(notificationLabel('direct_message')).toBe('sent you a message');
    expect(notificationLabel('task_assigned')).toBe('assigned you a task');
    expect(notificationLabel('task_status')).toBe('updated a task');
  });

  it('falls back for unknown types', () => {
    expect(notificationLabel('something_new')).toBe('sent a notification');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-12T12:00:00Z');

  it('minutes, hours, days', () => {
    expect(formatRelativeTime('2026-07-12T11:59:30Z', now)).toBe('now');
    expect(formatRelativeTime('2026-07-12T11:45:00Z', now)).toBe('15m');
    expect(formatRelativeTime('2026-07-12T09:00:00Z', now)).toBe('3h');
    expect(formatRelativeTime('2026-07-10T09:00:00Z', now)).toBe('2d');
  });

  it('falls back to a date beyond 7 days', () => {
    expect(formatRelativeTime('2026-06-01T09:00:00Z', now)).toMatch(/jun 1/i);
  });
});

describe('conversationTitle', () => {
  const users = [
    { id: 'u-me', name: 'Me' },
    { id: 'u-ana', name: 'Ana' },
  ] as User[];

  it('chat: counterpart name', () => {
    const chat = {
      id: 'x1ch',
      type: 'chat',
      collaborators: { 'u-me': 'admin', 'u-ana': 'admin' },
    } as unknown as LocalNode;
    expect(conversationTitle(chat, users, 'u-me')).toBe('Ana');
  });

  it('channel: its name', () => {
    const channel = { id: 'x2cn', type: 'channel', name: 'Design' } as unknown as LocalNode;
    expect(conversationTitle(channel, users, 'u-me')).toBe('Design');
  });

  it('missing node: fallback', () => {
    expect(conversationTitle(undefined, users, 'u-me')).toBe('Conversation');
  });
});
